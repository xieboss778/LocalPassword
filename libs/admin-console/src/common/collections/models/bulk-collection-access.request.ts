import { SelectionReadOnlyRequest } from "@localpass/common/admin-console/models/request/selection-read-only.request";

export class BulkCollectionAccessRequest {
  collectionIds: string[] = [];
  users: SelectionReadOnlyRequest[] = [];
  groups: SelectionReadOnlyRequest[] = [];
}
