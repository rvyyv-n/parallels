import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { render } from "preact";
import { App } from "./app";

render(<App />, document.getElementById("app")!);
