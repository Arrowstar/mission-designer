import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mission Designer — Spacecraft Trajectory Design Tool",
  description: "Design, propagate, visualize, and optimize multi-spacecraft trajectories with an intuitive web interface. Features RK45 propagation, NLopt optimization, and 3D visualization.",
  keywords: ["spacecraft", "mission design", "trajectory", "astrodynamics", "orbit", "optimization"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
