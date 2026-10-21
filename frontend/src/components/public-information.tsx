import { router } from 'expo-router';
import { Back, Button, Card, Page, Text, s } from './ui';

const information = {
  help: {
    title: 'Help',
    sections: [
      ['Finding a medicine', 'Search by name or generic, then check strength and form. Compare pharmacy listings; sample listings are labeled and live distances are unavailable.'],
      ['Ordering and prescriptions', 'Sign in to use the cart or upload prescriptions. Prescription medicines need pharmacist verification. Approved pharmacies receive submitted orders and prescriptions. Sample listings and simulated reviews are labeled.'],
      ['Account and connection problems', 'Use Forgot password to reset access. If the service is unavailable, retry after reconnecting; your browsing selection stays in the app.'],
      ['Contact information', 'A verified MediFind support email or phone number has not been supplied. Support contact details must be configured before public launch.'],
    ],
  },
  privacy: {
    title: 'Privacy information',
    sections: [
      ['Draft for review', 'This describes the current preview. Operator identity, support contact, retention periods, deletion procedures, and the final privacy policy must be supplied and reviewed before public launch.'],
      ['Information collected', 'Account registration collects your name, email, password, and optional phone number. Orders may include recipient details and a delivery address. Prescription uploads may contain sensitive health information. Public catalog browsing does not require an account or location permission.'],
      ['Storage and access', 'Account records and signed-in submissions are stored by the configured MediFind service. Prescription files are stored outside public media routes and require authenticated access. Rider assignment responses omit prescription contents. Delivery proof and issue photos are stored privately and can be viewed by authorized staff.'],
      ['Sessions and location', 'The app holds access tokens in memory. Refresh tokens use secure storage on mobile and tab session storage on web. Use my location requests foreground permission only when tapped. The device position is checked locally against approximate CDO barangay boundaries; you confirm its barangay in the location picker. It is saved to this browser tab only if you confirm the selection; no background location tracking is used. Typing in the location picker filters listed and previously saved places locally; it does not send search queries to an external service. Maps on pharmacy, order tracking, and rider delivery screens show approximate public areas, not live rider locations. Customer street addresses are not automatically geocoded. Embedded maps load content from OpenStreetMap, which receives normal web request information such as your IP address. Opening an address search sends that pharmacy or delivery address to OpenStreetMap. Map browsing is subject to the OpenStreetMap Foundation privacy policy.'],
      ['Your choices', 'Upload only information needed for the prescription review. You can inspect a selected file before continuing. Account and file deletion controls and a verified request contact are not yet available in this preview.'],
    ],
  },
  terms: {
    title: 'Terms information',
    sections: [
      ['Draft for review', 'These preview terms need review and completion by the MediFind operator. Legal identity, contact details, service coverage, cancellations, refunds, dispute handling, and effective date are not yet supplied.'],
      ['Using the preview', 'Sample catalog listings create order previews. Approved pharmacies can accept submitted orders, reserve stock, and arrange rider collection. Prescription orders require pharmacist approval. Payment is collected at pickup or delivery; online payments are unavailable.'],
      ['Medicine information', 'Catalog information is for finding an exact medicine and formulation. Confirm availability and suitability with a pharmacist. Prescription medicines require valid prescriptions and pharmacist verification.'],
      ['Accounts', 'Public registration creates a customer account. Rider approval and dispatch are managed by authorized staff. Keep your sign-in details private and provide accurate recipient information.'],
    ],
  },
} as const;

export function PublicInformation({ page }: { page: keyof typeof information }) {
  const content = information[page];
  return <Page><Back title={content.title} />{content.sections.map(([title, body]) => <Card key={title}><Text style={s.heading}>{title}</Text><Text style={s.text}>{body}</Text></Card>)}<Button title="Browse medicines" secondary onPress={() => router.push('/search')} /></Page>;
}
