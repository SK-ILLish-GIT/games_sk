FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/nginx.conf
# Remove the default server block that ships with the nginx image.
# It listens on port 80 with server_name localhost and serves static files
# from /usr/share/nginx/html — it loads before routes.conf (alphabetically)
# and intercepts every request, causing 404s instead of proxying to services.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY conf.d/ /etc/nginx/conf.d/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
