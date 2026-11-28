import { ThemeTypes } from "@localpass/common/platform/enums";
import { CipherRepromptType, CipherType } from "@localpass/common/vault/enums";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { mockCardCiphers } from "../../lit-stories/mock-data";
import {
  InlineMenuCardIdentityMenu,
  InlineMenuCardIdentityMenuI18n,
  orderCardIdentityCiphers,
} from "../card-identity-menu";
import { InlineMenuFooter } from "../menu-footer";
import { InlineMenuHeader } from "../menu-header";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../menu-header", () => ({ InlineMenuHeader: jest.fn(() => "header") }));
jest.mock("../menu-footer", () => ({ InlineMenuFooter: jest.fn(() => "footer") }));
jest.mock("../menu-shell", () => ({
  InlineMenuShell: jest.fn(({ children }) => children),
}));

const i18n: InlineMenuCardIdentityMenuI18n = {
  cardsTitle: "Cards",
  identityTitle: "Identity & address",
  favorite: "Favorite",
  fill: "Fill",
  fillCardAria: "Fill card {name}",
  fillIdentityAria: "Fill identity {name}",
  cardMaskedNote: "Full card number stays hidden",
  identityFillNote: "Fills name and address",
  keysHint: "↑↓ ↵ esc",
  closeAria: "Close LocalPass menu",
  showAll: "Show all",
  cardMenuAriaLabel: "LocalPass card suggestions",
  identityMenuAriaLabel: "LocalPass identity suggestions",
};

describe("orderCardIdentityCiphers", () => {
  it("sorts favorites first and keeps the remaining order stable", () => {
    const cipher = (id: string, favorite: boolean): InlineMenuCipherData => ({
      id,
      name: id,
      type: CipherType.Card,
      reprompt: CipherRepromptType.None,
      favorite,
      icon: { imageEnabled: false, image: "", fallbackImage: "", icon: "globe" },
    });

    const ordered = orderCardIdentityCiphers([
      cipher("a", false),
      cipher("b", true),
      cipher("c", false),
      cipher("d", true),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("does not mutate the caller's list", () => {
    const ciphers = [...mockCardCiphers];

    orderCardIdentityCiphers(ciphers);

    expect(ciphers.map((entry) => entry.id)).toEqual(["1", "2"]);
  });
});

describe("InlineMenuCardIdentityMenu", () => {
  const baseProps = {
    theme: ThemeTypes.Light,
    ciphers: mockCardCiphers,
    i18n,
    onFill: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("labels the header with the card context", () => {
    InlineMenuCardIdentityMenu({ ...baseProps, kind: "card" });

    expect(InlineMenuHeader).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "Cards", showContext: false }),
    );
  });

  it("labels the header with the identity context", () => {
    InlineMenuCardIdentityMenu({ ...baseProps, kind: "identity" });

    expect(InlineMenuHeader).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "Identity & address", showContext: false }),
    );
  });

  it("keeps the card mask note and compact key hint in the keyboard strip", () => {
    InlineMenuCardIdentityMenu({ ...baseProps, kind: "card" });

    expect(InlineMenuFooter).toHaveBeenCalledWith({
      theme: ThemeTypes.Light,
      hint: { text: "Full card number stays hidden", right: "↑↓ ↵ esc" },
    });
  });

  it("uses the identity fill note for identity suggestions", () => {
    InlineMenuCardIdentityMenu({ ...baseProps, kind: "identity" });

    expect(InlineMenuFooter).toHaveBeenCalledWith({
      theme: ThemeTypes.Light,
      hint: { text: "Fills name and address", right: "↑↓ ↵ esc" },
    });
  });
});
