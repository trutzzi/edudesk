// The message a therapist's WhatsApp opens with. Clients are written to in Romanian whatever the app's language.
export const WHATSAPP_GREETING = 'Salutare, vă contactez din partea echipei Blue, în legătură cu…';

// Phones come from the backend as "+40722123456"
export const callHref = (phone: string) => `tel:${phone}`;

// wa.me wants the number without "+", and opens the chat with the text typed in, ready to finish and send
export const whatsappHref = (phone: string, text = WHATSAPP_GREETING) =>
  `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`;
