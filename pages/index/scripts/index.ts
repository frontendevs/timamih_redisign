import { initCopyContact } from "../../shared/ui/copyContact.ts";
import { footerYear } from "../../shared/ui/footerYear.ts";
import { registerIsland } from "../../shared/ui/island.ts";
import { initNavDrawer } from "../../shared/ui/navDrawer.ts";
import { scrollReveal } from "../../shared/ui/scrollReveal.ts";
import { initStepsCarousel } from "../../shared/ui/stepsCarousel.ts";
import { initThemeToggle } from "../../shared/ui/themeToggle.ts";
import { toast } from "../../shared/ui/toast.ts";
import { initVideoModal } from "../../shared/ui/videoModal.ts";
import { bootstrap } from "../../shared/utils/bootstrap.ts";

// bootstrap() is the single lifecycle owner; registerIsland() returns its cleanup into it.
bootstrap(() => [
	footerYear(),
	toast(),
	scrollReveal(),
	registerIsland("nav-drawer", initNavDrawer, { eager: true }),
	registerIsland("theme-toggle", initThemeToggle, { eager: true }),
	registerIsland("video-modal", initVideoModal, { eager: true }),
	registerIsland("steps-carousel", initStepsCarousel),
	registerIsland("copy-contact", initCopyContact),
]);
