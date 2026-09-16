import { app } from "./app";
import { config } from "./config";

app.listen(config.port, "0.0.0.0", () => {
  console.log(`SealML backend listening on http://0.0.0.0:${config.port}`);
});
