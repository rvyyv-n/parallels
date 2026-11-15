import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "../styles.css";
import "./learn.css";
import { render } from "preact";
import { Learn } from "./Page";

render(<Learn />, document.getElementById("app")!);
