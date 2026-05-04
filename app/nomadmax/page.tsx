import { redirect } from "next/navigation";

export const metadata = {
  title: "Nomad Max — redirecting",
  description: "Nomad Max — tools for life on the road.",
};

export default function NomadMaxRedirect() {
  redirect("/nomad.html");
}
