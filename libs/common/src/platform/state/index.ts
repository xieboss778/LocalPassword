import { StateUpdateOptions as RequiredStateUpdateOptions } from "@localpass/state";

export * from "@localpass/state";
export { ActiveUserAccessor } from "@localpass/state-internal";

export type StateUpdateOptions<T, TCombine> = Partial<RequiredStateUpdateOptions<T, TCombine>>;
