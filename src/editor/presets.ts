import type { UiLayoutDocument } from "./types";

const DEFAULT_STAGE_WIDTH = 960;
const DEFAULT_STAGE_HEIGHT = 540;

export function createStarterUiLayoutDocument(seed: number): UiLayoutDocument {
  return {
    id: `new-ui-layout-${seed}`,
    kind: "ui-layout",
    name: `NewLayout${seed}.json`,
    nodes: [
      {
        id: 1,
        parent: 0,
        type: 1,
        n: "RootCanvas",
        x: 0,
        y: 0,
        w: DEFAULT_STAGE_WIDTH,
        h: DEFAULT_STAGE_HEIGHT,
        ax: 0.5,
        ay: 0.5,
        color: "#16263A",
        v: true
      },
      {
        id: 2,
        parent: 1,
        type: 1,
        n: "PanelBg",
        x: 480,
        y: 270,
        w: 480,
        h: 320,
        ax: 0.5,
        ay: 0.5,
        color: "#243C5A",
        res: "ui/panel_bg.png"
      },
      {
        id: 3,
        parent: 2,
        type: 3,
        n: "TitleText",
        x: 240,
        y: 280,
        w: 240,
        h: 36,
        ax: 0.5,
        ay: 0.5,
        text: "New UI Layout",
        fs: 24,
        color: "#F7E3A1"
      },
      {
        id: 4,
        parent: 2,
        type: 2,
        n: "ConfirmButton",
        x: 240,
        y: 56,
        w: 156,
        h: 52,
        ax: 0.5,
        ay: 0.5,
        text: "Confirm",
        fs: 18,
        color: "#FFFFFF",
        res: "ui/btn_confirm.png",
        sel: "ui/btn_confirm_down.png",
        dis: "ui/btn_confirm_disabled.png"
      },
      {
        id: 5,
        parent: 2,
        type: 4,
        n: "IconPreview",
        x: 88,
        y: 164,
        w: 96,
        h: 96,
        ax: 0.5,
        ay: 0.5,
        res: "ui/icon_sample.png"
      }
    ],
    sourceFormat: "json",
    sourcePath: null
  };
}

export const STAGE_SIZE = {
  width: DEFAULT_STAGE_WIDTH,
  height: DEFAULT_STAGE_HEIGHT
};
