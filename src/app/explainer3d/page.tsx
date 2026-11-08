import type { Metadata } from "next";
import ExplainerScene from "./ExplainerScene";

export const metadata: Metadata = {
  title: "How SUGOMATE Works | 3D Order Journey",
  description: "An interactive 3D introduction to how SUGOMATE connects customers, merchants, delivery partners and operations.",
};

export default function Explainer3DPage() {
  return <ExplainerScene />;
}
