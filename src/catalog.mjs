import { readFileSync } from 'node:fs';

let knownApps = {};
try {
  knownApps = JSON.parse(readFileSync(new URL('./known_apps.json', import.meta.url), 'utf8'));
} catch (e) {}

const defaultApps = {
  '00000002-0000-0ff1-ce00-000000000000': 'Office 365 Exchange Online',
  '00000003-0000-0ff1-ce00-000000000000': 'Office 365 SharePoint Online / OneDrive',
  '00000004-0000-0ff1-ce00-000000000000': 'Skype for Business Online',
  '00000002-0000-0000-c000-000000000000': 'Azure Active Directory Graph',
  '00000003-0000-0000-c000-000000000000': 'Microsoft Graph',
  '04b07795-8ddb-461a-bbee-02f9e1bf7b46': 'Microsoft Azure CLI',
  '08e18876-6177-487e-b8b5-cf950c1e598c': 'SharePoint Online Web Client Extensibility',
  '38aa3b87-a06d-4817-b275-7a316988d93b': 'Windows Sign In',
  '1b730954-1685-4b74-9bfd-dac224a7b894': 'Azure Active Directory PowerShell',
  '1fec8e78-bce4-4aaf-ab1b-5451cc387264': 'Microsoft Teams',
  '5e3ce6c0-2b1f-4285-8d4b-75ee78787346': 'Microsoft Teams Web Client',
  '4765445b-32c6-49b0-83e6-1d93765276ca': 'OfficeHome (Microsoft 365 Web)',
  '51f81489-12ee-4a9e-aaae-a2591f45987d': 'Dynamics 365 / CRM Online Client'
};

const applications = new Map(Object.entries({ ...defaultApps, ...knownApps }));

export function applicationName(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Uygulama bilinmiyor';
  const match = raw.match(/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/i);
  if (match) {
    const guid = match[1].toLowerCase();
    if (applications.has(guid)) return applications.get(guid);
    return `Uygulama kimliği · ${match[1]}`;
  }
  return applications.get(raw.toLowerCase()) || raw;
}
