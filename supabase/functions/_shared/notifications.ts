type Applicant = {
  full_name: string;
  phone: string;
  email: string;
  role?: string;
};

async function sendSms(phone: string, message: string): Promise<void> {
  const apiKey = Deno.env.get("AT_API_KEY");
  const username = Deno.env.get("AT_USERNAME");
  if (!apiKey || !username) throw new Error("Africa's Talking is not configured.");

  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ username, to: phone, message }),
  });

  const result = await response.json().catch(() => null);
  const recipients = result?.SMSMessageData?.Recipients;
  const delivered = Array.isArray(recipients) && recipients.some((recipient) => recipient.statusCode === 101);
  if (!response.ok || !delivered) {
    console.error(`Africa's Talking request failed (${response.status}).`);
    throw new Error("SMS could not be sent.");
  }
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Resend is not configured.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!response.ok) {
    console.error(`Resend request failed (${response.status}).`);
    throw new Error("Email could not be sent.");
  }
}

async function reportDelivery(tasks: Array<{ channel: string; send: () => Promise<void> }>): Promise<string[]> {
  const results = await Promise.allSettled(tasks.map(({ send }) => send()));
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`${tasks[index].channel} notification was not delivered.`);
      warnings.push(`${tasks[index].channel} notification could not be delivered.`);
    }
  });
  return warnings;
}

export function sendApplicationNotifications(
  applicant: Applicant,
  checkoutUrl: string,
  agencyEmail?: string,
  paymentTermsUrl?: string,
): Promise<string[]> {
  const fee = "UGX 150,000";
  const applicantText =
    `Hello ${applicant.full_name}, we received your Real Hustlers application. ` +
    `${applicant.role ? `Role: ${applicant.role}. ` : ""}Registration and paperwork payment: ${fee}. ` +
    `Payment does not guarantee a job, visa, or employment. ` +
    `${paymentTermsUrl ? `Fee and refund terms: ${paymentTermsUrl}. ` : ""}` +
    `Complete payment securely here: ${checkoutUrl}`;

  const tasks = [
    { channel: "SMS", send: () => sendSms(applicant.phone, applicantText) },
    {
      channel: "Email",
      send: () => sendEmail(
        applicant.email,
        "Your Real Hustlers application",
        applicantText,
      ),
    },
  ];

  if (agencyEmail) {
    tasks.push({
      channel: "Agency email",
      send: () => sendEmail(
        agencyEmail,
        "New Real Hustlers application",
        `A new application was submitted for ${applicant.full_name}. Role: ${applicant.role ?? "not specified"}. Payment: pending.`,
      ),
    });
  }

  return reportDelivery(tasks);
}

export function sendPaymentConfirmation(applicant: Applicant, agencyEmail?: string): Promise<string[]> {
  const message = `Hello ${applicant.full_name}, your UGX 150,000 registration and paperwork payment was confirmed by Flutterwave. Real Hustlers' Agency will contact you about your application.`;
  const tasks = [
    { channel: "SMS", send: () => sendSms(applicant.phone, message) },
    { channel: "Email", send: () => sendEmail(applicant.email, "Payment confirmed — Real Hustlers", message) },
  ];
  if (agencyEmail) {
    tasks.push({
      channel: "Agency email",
      send: () => sendEmail(agencyEmail, "Real Hustlers payment confirmed", `A candidate completed the UGX 150,000 application payment. Applicant: ${applicant.full_name}.`),
    });
  }
  return reportDelivery(tasks);
}
