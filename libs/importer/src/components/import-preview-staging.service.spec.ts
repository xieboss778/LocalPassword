import { StagedPreviewFile, ImportPreviewStagingService } from "./import-preview-staging.service";

describe("ImportPreviewStagingService", () => {
  const staged: StagedPreviewFile = {
    importType: "localpassjson",
    fileName: "backup.json",
    contents: '{"encrypted":false,"items":[]}',
  };

  let service: ImportPreviewStagingService;

  beforeEach(() => {
    service = new ImportPreviewStagingService();
  });

  it("starts empty", () => {
    expect(service.take()).toBeNull();
  });

  it("hands the file to the preview and consumes it on take", () => {
    service.set(staged);

    expect(service.take()).toEqual(staged);
    // A refresh of the preview cannot parse the same decrypted file twice.
    expect(service.take()).toBeNull();
  });

  it("keeps only the newest picked file", () => {
    service.set(staged);
    service.set({ ...staged, fileName: "second.json" });

    expect(service.take()?.fileName).toBe("second.json");
  });

  it("drops the staged file on cancel", () => {
    service.set(staged);

    service.clear();

    expect(service.take()).toBeNull();
  });
});
