import {
  concat,
  defer,
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
} from "rxjs";

import { MessageListener } from "@localpass/common/platform/messaging";
import { UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/services/cipher.service";
import { CipherListView } from "@localpass/sdk-internal";

import { BrowserApi } from "../../platform/browser/browser-api";

export const GET_CIPHER_LIST_VIEWS = "getCipherListViews";

/** What the background's `ListViewsAnnouncerService` sends each time its list views change. */
export const CIPHER_LIST_VIEWS_CHANGED = "cipherListViewsChanged";

/**
 * The popup's cipher service. Takes the list views from the background, which already
 * decrypted them, instead of decrypting the whole vault again on every popup open.
 */
export class ForegroundCipherService extends CipherService {
  private readonly clearListViews$ = new Subject<UserId | null>();
  private readonly listViewsCache = new Map<UserId, Observable<CipherListView[] | null>>();

  constructor(
    private readonly messageListener: MessageListener,
    ...cipherServiceArgs: ConstructorParameters<typeof CipherService>
  ) {
    super(...cipherServiceArgs);
  }

  // Fetches when opened and whenever the background announces new list views, so the popup
  // never asks before the background caught up with a change.
  override cipherListViewsIncludingRestricted$ = (
    userId: UserId,
  ): Observable<CipherListView[] | null> => {
    let listViews$ = this.listViewsCache.get(userId);
    if (listViews$ == null) {
      listViews$ = merge(
        this.messageListener.allMessages$.pipe(
          filter((message) => message.command === CIPHER_LIST_VIEWS_CHANGED),
          switchMap(() => this.fetchListViews(userId)),
        ),
        this.clearListViews$.pipe(
          filter((clearId) => clearId === userId || clearId === null),
          // A clear from a local save, restore or delete leaves the currently open screen
          // subscribed. Emitting null alone would strand that screen on an empty list, so drop
          // the old copy and fetch the new views. If the write has not reached the background's
          // cache yet, its list-view announcement triggers another fetch.
          switchMap(() => concat(of(null), this.fetchListViews(userId))),
        ),
        // Every fresh subscription asks the background again. An announcement can be missed
        // while no vault screen is open (e.g. the background is still starting), and a replay of
        // the cleared buffer would otherwise leave the list blank until the next announcement.
        defer(() => this.fetchListViews(userId)),
      ).pipe(
        // Tying the source to its subscribers drops both the subscription and the buffered
        // views as soon as the vault screen closes, so a cleared popup keeps nothing decrypted.
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.listViewsCache.set(userId, listViews$);
    }
    return listViews$;
  };

  /** Drops the popup's copy of the list views too, e.g. on lock. */
  override async clearCache(userId?: UserId): Promise<void> {
    await super.clearCache(userId);
    this.clearListViews$.next(userId ?? null);
  }

  private fetchListViews(userId: UserId): Observable<CipherListView[] | null> {
    // No answer, e.g. from a background still starting after a restart, is not ready yet;
    // the background announces its list views once it has decrypted them.
    return from(
      BrowserApi.sendMessageWithResponse<{ result: CipherListView[] }>(GET_CIPHER_LIST_VIEWS, {
        userId,
      }),
    ).pipe(map((response) => response?.result ?? null));
  }
}
