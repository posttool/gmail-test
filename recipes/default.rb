cert = ssl_certificate "maily" do
  namespace node["postfix-dovecot"]
  notifies :restart, "service[apache2]"
end
log "maily certificate is here: #{cert.cert_path}"
log "maily private key is here: #{cert.key_path}"

#include_recipe "mysql::server"
#include_recipe "mysql::client"
#include_recipe "database::mysql"

include_recipe 'ubuntu-mongo-node::default'

include_recipe 'postfix-dovecot::default'

postfixadmin_admin 'david@pagesociety.net' do
  password '444333999'
  action :create
end

postfixadmin_domain 'pagesociety.net' do
  login_username 'david@pagesociety.net'
  login_password '444333999'
end

postfixadmin_mailbox 'david@pagesociety.net' do
  password 'david'
  login_username 'david@pagesociety.net'
  login_password '444333999'
end

#postfixadmin_alias 'billing@foobar.com' do
#  goto 'bob@foobar.com'
#  login_username 'admin@admindomain.com'
#  login_password 'sup3r-s3cr3t-p4ss'
#end



