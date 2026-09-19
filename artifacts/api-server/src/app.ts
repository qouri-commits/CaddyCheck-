import router from "./routes";
import { createHttpApp } from "./http";

export default createHttpApp(router);
