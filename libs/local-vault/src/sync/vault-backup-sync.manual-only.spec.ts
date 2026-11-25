import { readFileSync } from "fs";
import { join } from "path";

/**
 * 守护「备份纯手动」这条产品承诺：同步服务里不允许出现任何后台调度。
 * 这条测试故意读源码——它要防的正是「以后有人顺手加个 setInterval」。
 */
describe("backup sync is manual only", () => {
  const source = readFileSync(join(__dirname, "vault-backup-sync.service.ts"), "utf8");

  it("does not schedule anything", () => {
    expect(source).not.toMatch(/setInterval/);
    expect(source).not.toMatch(/setTimeout/);
    expect(source).not.toMatch(/requestIdleCallback/);
  });

  it("does not import a timer or scheduler", () => {
    expect(source).not.toMatch(/timer-scheduler/);
    expect(source).not.toMatch(/scheduler/i);
  });

  it("only uploads from an explicit sync call", () => {
    // uploadAccountObject 只能被 pull/push/sync 内的显式调用链触达。
    const uploadCalls = source.match(/uploadAccountObject\(/g) ?? [];
    expect(uploadCalls.length).toBeLessThanOrEqual(2);
  });
});
