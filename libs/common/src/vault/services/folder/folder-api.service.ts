import { ApiService } from "../../../abstractions/api.service";
import { UserId } from "../../../types/guid";
import { FolderApiServiceAbstraction } from "../../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { FolderData } from "../../../vault/models/data/folder.data";
import { Folder } from "../../../vault/models/domain/folder";
import { FolderBulkDeleteRequest } from "../../../vault/models/request/folder-bulk-delete.request";
import { FolderRequest } from "../../../vault/models/request/folder.request";
import { FolderResponse } from "../../../vault/models/response/folder.response";
import { LocalVaultWriter } from "../../abstractions/local-vault-writer.abstraction";
import { NoopLocalVaultWriter } from "../noop-local-vault-writer.service";

export class FolderApiService implements FolderApiServiceAbstraction {
  constructor(
    private folderService: InternalFolderService,
    private apiService: ApiService,
    /** Write path for accounts that live only on this device. */
    private localVaultWriter: LocalVaultWriter = new NoopLocalVaultWriter(),
  ) {}

  async save(folder: Folder, userId: UserId): Promise<FolderData> {
    // A local vault stores the folder itself; there is no server to save it on. Drop the
    // decrypted cache *before* writing so the state update that follows decrypts the new list
    // instead of re-emitting the pre-write snapshot.
    if (await this.localVaultWriter.isLocalAccount(userId)) {
      await this.folderService.clearDecryptedFolderState(userId);
      const local = await this.localVaultWriter.saveFolder(folder, userId);
      if (local != null) {
        folder.id = local.id;
        return local;
      }
    }

    const request = new FolderRequest(folder);

    let response: FolderResponse;
    if (folder.id) {
      response = await this.putFolder(folder.id, request);
    } else {
      response = await this.postFolder(request);
      folder.id = response.id;
    }

    const data = new FolderData(response);
    await this.folderService.upsert(data, userId);
    return data;
  }

  async delete(id: string, userId: UserId): Promise<any> {
    if (await this.localVaultWriter.isLocalAccount(userId)) {
      await this.folderService.clearDecryptedFolderState(userId);
      if (await this.localVaultWriter.deleteFolder([id], userId)) {
        return;
      }
    }
    await this.deleteFolder(id);
    await this.folderService.delete(id, userId);
  }

  async deleteMany(ids: string[], userId: UserId): Promise<any> {
    if (await this.localVaultWriter.isLocalAccount(userId)) {
      await this.folderService.clearDecryptedFolderState(userId);
      if (await this.localVaultWriter.deleteFolder(ids, userId)) {
        return;
      }
    }
    await this.apiService.send("DELETE", "/folders", new FolderBulkDeleteRequest(ids), true, false);
    await this.folderService.delete(ids, userId);
  }

  async deleteAll(userId: UserId): Promise<void> {
    if (await this.localVaultWriter.isLocalAccount(userId)) {
      await this.folderService.clear(userId);
      return;
    }
    await this.apiService.send("DELETE", "/folders/all", null, true, false);
    await this.folderService.clear(userId);
  }

  async get(id: string): Promise<FolderResponse> {
    const r = await this.apiService.send("GET", "/folders/" + id, null, true, true);
    return new FolderResponse(r);
  }

  private async postFolder(request: FolderRequest): Promise<FolderResponse> {
    const r = await this.apiService.send("POST", "/folders", request, true, true);
    return new FolderResponse(r);
  }

  async putFolder(id: string, request: FolderRequest): Promise<FolderResponse> {
    const r = await this.apiService.send("PUT", "/folders/" + id, request, true, true);
    return new FolderResponse(r);
  }

  private deleteFolder(id: string): Promise<any> {
    return this.apiService.send("DELETE", "/folders/" + id, null, true, false);
  }
}
