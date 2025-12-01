FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/

# Expose IMAP and SMTP ports
EXPOSE 993 465

# Environment variables
ENV NODE_ENV=production
ENV IMAP_PORT=993
ENV SMTP_PORT=465
ENV USE_TLS=true

# Start the mail server
CMD ["bun", "run", "src/index.ts"]
