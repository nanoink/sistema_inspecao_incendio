export type ClaimedDelivery = {
  delivery_id: string;
  campaign_id: string;
  recipient_email: string;
  recipient_name: string | null;
  unsubscribe_token: string;
  subject: string;
  preview_text: string | null;
  html_body: string;
  sender_name: string;
  reply_to: string | null;
};
