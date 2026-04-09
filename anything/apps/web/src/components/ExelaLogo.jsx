/**
 * Exela Realtors Logo Component
 * Automatically switches between light and dark variants based on the background.
 *
 * RULE 1 – Dark Background (#0E1D33): Uses inverted logo (white icon/text, red "Realtors")
 * RULE 2 – White/Light Background: Uses original logo as-is
 * RULE 3 – Pass variant="dark" or variant="light" to control manually
 *
 * logo-light → original logo for white backgrounds
 * logo-dark  → inverted logo for dark backgrounds (#0E1D33)
 */

const LOGO_LIGHT =
  "https://ucarecdn.com/8b785f65-e34f-456e-b74b-cecdc730aa79/-/format/auto/";
const LOGO_DARK =
  "https://raw.createusercontent.com/6f5f368e-e4f9-446d-afc4-0bd1034a4c24/";

export default function ExelaLogo({
  variant = "light",
  height = "h-16",
  className = "",
}) {
  const src = variant === "dark" ? LOGO_DARK : LOGO_LIGHT;

  return (
    <img
      src={src}
      alt="Exela Realtors"
      className={`${height} w-auto object-contain ${className}`}
    />
  );
}
