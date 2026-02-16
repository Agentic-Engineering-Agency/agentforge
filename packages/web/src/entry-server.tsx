import { renderToString } from "react-dom/server";
import { StartServer } from "@tanstack/start/server";
import { createRouter } from "./router";

export function render(url: string) {
  const router = createRouter();
  return renderToString(<StartServer router={router} url={url} />);
}
