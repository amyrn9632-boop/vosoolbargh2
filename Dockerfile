# سامانه وصول مطالبات — ایمیج تولیدی
# ساخت از ریشه‌ی پروژه:  docker build -f site/Dockerfile -t vosol .
# اجرا:  docker run -d --name vosol -p 3000:3000 --env-file site/.env -v vosol-data:/app/data vosol

FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    DATA_DIR=/app/data \
    ASSETS_DIR=/app/assets

WORKDIR /app

# وابستگی‌ها (sharp باینری prebuilt لینوکس دارد؛ نیازی به build-essential نیست)
COPY site/package.json site/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# کد برنامه، رابط کاربری و دارایی‌های برند
COPY site/server ./server
COPY site/public ./public
COPY assets ./assets

RUN mkdir -p /app/data/uploads /app/data/voice /app/data/ocr-cache \
    && chown -R node:node /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
