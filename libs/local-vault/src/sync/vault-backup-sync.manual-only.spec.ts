import { readFileSync } from "fs";
import { join } from "path";

/**
 * 守护「备份纯手动」这条产品承诺：上传服务里不允许出现任何后台调度。
 * 这条测试故意读源码——它要防的正是「以后有人顺手加个 setInterval」。
 */
describe("backup sync is manual only", () => {
  const sources = ["vault-backup-sync.service.ts", "vault-backup.service.ts"].map((file) =>
    readFileSync(join(__dirname, file), "utf8"),
  );

  it("does not schedule anything", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/setInterval/);
      expect(source).not.toMatch(/setTimeout/);
      expect(source).not.toMatch(/requestIdleCallback/);
    }
  });

  it("does not import a timer or scheduler", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/timer-scheduler/);
      expect(source).not.toMatch(/scheduler/i);
    }
  });
});
