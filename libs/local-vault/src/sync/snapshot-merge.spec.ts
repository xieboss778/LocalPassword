import { mergeSnapshots, snapshotsEqual, Snapshot } from "./snapshot-merge";

const snap = (over: Partial<Snapshot>): Snapshot => ({
  updatedAt: "2026-11-24T00:00:00.000Z",
  ciphers: [],
  folders: [],
  tombstones: [],
  ...over,
});

describe("mergeSnapshots", () => {
  it("keeps the newer revision of the same item", () => {
    const local = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T10:00:00.000Z" }] });
    const remote = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T09:00:00.000Z" }] });

    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.ciphers).toHaveLength(1);
    expect(snapshot.ciphers[0].revisionDate).toBe("2026-11-24T10:00:00.000Z");
  });

  it("takes the remote revision when it is newer", () => {
    const local = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T08:00:00.000Z" }] });
    const remote = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T09:00:00.000Z" }] });

    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.ciphers[0].revisionDate).toBe("2026-11-24T09:00:00.000Z");
  });

  it("unions items that exist on only one side", () => {
    const local = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T08:00:00.000Z" }] });
    const remote = snap({ ciphers: [{ id: "c2", revisionDate: "2026-11-24T09:00:00.000Z" }] });

    const { snapshot, conflicts } = mergeSnapshots(local, remote);
    expect(snapshot.ciphers.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(conflicts).toHaveLength(0);
  });

  it("removes an item whose tombstone is newer than the edit", () => {
    const local = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T08:00:00.000Z" }] });
    const remote = snap({ tombstones: [{ id: "c1", deletedAt: "2026-11-24T09:00:00.000Z" }] });

    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.ciphers).toHaveLength(0);
    expect(snapshot.tombstones).toEqual([{ id: "c1", deletedAt: "2026-11-24T09:00:00.000Z" }]);
  });

  it("keeps an item edited after the delete", () => {
    const local = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T10:00:00.000Z" }] });
    const remote = snap({ tombstones: [{ id: "c1", deletedAt: "2026-11-24T09:00:00.000Z" }] });

    const { snapshot } = mergeSnapshots(local, remote);
    expect(snapshot.ciphers).toHaveLength(1);
    expect(snapshot.tombstones).toHaveLength(0);
  });

  it("reports a conflict when both sides changed since the last sync", () => {
    const base = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T07:00:00.000Z" }] });
    const local = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T10:00:00.000Z" }] });
    const remote = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T09:00:00.000Z" }] });

    const { conflicts, snapshot } = mergeSnapshots(local, remote, base);
    expect(conflicts).toEqual([
      {
        id: "c1",
        localRevision: "2026-11-24T10:00:00.000Z",
        remoteRevision: "2026-11-24T09:00:00.000Z",
        winner: "local",
      },
    ]);
    expect(snapshot.ciphers[0].revisionDate).toBe("2026-11-24T10:00:00.000Z");
  });

  it("is deterministic for identical revisions", () => {
    const local = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T10:00:00.000Z" }] });
    const remote = snap({ ciphers: [{ id: "c1", revisionDate: "2026-11-24T10:00:00.000Z" }] });

    const forward = mergeSnapshots(local, remote).snapshot;
    const backward = mergeSnapshots(remote, local).snapshot;
    expect(snapshotsEqual(forward, backward)).toBe(true);
  });
});
