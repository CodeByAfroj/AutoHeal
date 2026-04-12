FROM kestra/kestra:latest

USER root
RUN /app/kestra plugins install io.kestra.plugin:plugin-ai:LATEST
RUN chown -R kestra:kestra /app/plugins

USER kestra
