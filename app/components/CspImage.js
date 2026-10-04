import Image from "next/image";

// Next/Image normally emits an inline `color: transparent` declaration.
// Images here have explicit dimensions and external CSS, so omit that default
// to preserve the site's style-src 'self' policy without unsafe-inline.
export default function CspImage(props) {
  return <Image {...props} style={{ color: "" }} />;
}
