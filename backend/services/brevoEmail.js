const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const getBrevoConfig = () => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_FROM_EMAIL;
    const senderName =
        process.env.BREVO_FROM_NAME || 'Super Daily';

    if (!apiKey || !senderEmail) {
        throw new Error(
            'Brevo email configuration is missing',
        );
    }

    return {
        apiKey,
        senderEmail,
        senderName,
    };
};

const sendEmail = async ({
    to,
    subject,
    htmlContent,
    textContent,
}) => {
    const {
        apiKey,
        senderEmail,
        senderName,
    } = getBrevoConfig();

    if (
        typeof to !== 'string' ||
        typeof subject !== 'string' ||
        typeof htmlContent !== 'string'
    ) {
        throw new Error('Invalid email arguments');
    }

    const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            sender: {
                name: senderName,
                email: senderEmail,
            },
            to: [{ email: to }],
            subject,
            htmlContent,
            ...(textContent ? { textContent } : {}),
        }),
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        throw new Error(
            `Brevo email request failed with status ${response.status}`,
        );
    }

    return response.json();
};

module.exports = {
    sendEmail,
};