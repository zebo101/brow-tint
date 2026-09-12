import { permanentRedirect } from 'next/navigation';

export default function LegacyBrowToolPage() {
  permanentRedirect('/filter');
}
