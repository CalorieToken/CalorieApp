# Public deployment guidance

Deploy the frontend and backend only after the repository tests and release checks pass. Production environments require HTTPS, explicit origins and redirects, securely managed environment values, protected databases, restricted administrative access, monitoring and a tested rollback process.

Never commit production credentials, database contents, cookies, authorization codes or deployment-specific private configuration. Provider-specific procedures and live endpoints are maintained privately.
