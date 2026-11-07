import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "../assets/sugomate-app-icon.svg");
const target = path.resolve(here, "../assets/sugomate-app-icon.png");

await sharp(source, { density: 384 })
  .resize(1024, 1024, { fit: "cover" })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(target);

console.log("Generated SUGOMATE 1024x1024 app icon:", target);
