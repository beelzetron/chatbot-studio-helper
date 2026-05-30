FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder

WORKDIR /app

COPY --chown=1001:0 package*.json ./
USER 1001
RUN npm ci

COPY --chown=1001:0 . .
RUN npm run build

FROM registry.access.redhat.com/ubi9/nginx-124:latest

USER root

COPY --from=builder --chown=1001:0 /app/dist /opt/app-root/src
COPY --chown=1001:0 nginx.conf /opt/app-root/etc/nginx.d/app.conf

RUN chown -R 1001:0 /opt/app-root && \
    chmod -R g+rwX /opt/app-root

USER 1001

EXPOSE 8080

CMD ["/usr/libexec/s2i/run"]
