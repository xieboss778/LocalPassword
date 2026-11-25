import { ConsoleLogService } from "@localpass/common/platform/services/console-log.service";

import MainBackground from "../background/main.background";

const logService = new ConsoleLogService(false);
const localpassMain = ((self as any).localpassMain = new MainBackground());
localpassMain.bootstrap().catch((error) => logService.error(error));
