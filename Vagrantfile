

Vagrant.configure("2") do |config|
  config.omnibus.chef_version = '11.16'
  config.berkshelf.enabled = true

  config.vm.box = "precise64"

  config.vm.provider "virtualbox" do |v|
      v.memory = 3120
      v.cpus = 4
      v.customize ["modifyvm", :id, "--cpuexecutioncap", "100"]
    end


  #config.ssh.insert_key = true
  #config.ssh.forward_agent = true
  config.ssh.password = "vagrant"

  config.vm.network "private_network", ip: "10.11.12.25"

  config.vm.synced_folder "app", "/home/vagrant/app"



  $provision_script= <<SCRIPT
  if [[ $(which chef-solo) != '/usr/bin/chef-solo' ]]; then
    curl -L https://www.opscode.com/chef/install.sh | sudo bash
    echo 'export PATH="/opt/chef/embedded/bin:$PATH"' >> ~/.bash_profile && source ~/.bash_profile
  fi
SCRIPT
  config.vm.provision :shell, :inline => $provision_script

  config.vm.provision :chef_solo do |chef|
    chef.json = {
      :hostname => "xxx",
      :user => "vagrant",
      :node_env => "development",
      :mongodb => {
        "package-version" => "2.6.3"
      },
      :nodejs => {
        :version => "0.10.29"
      },
      "postfix-dovecot" => {
        :postmaster_address => "dkaram@gmail.com",
        :hostname => "mail.pagesociety.net"
      },
      :apache => {
        :listen_ports => %w(3333)
      },
      :postfixadmin => {
        :port => "3334",
        :ssl => true
      }
    }

    chef.run_list = [
      "recipe[maily::default]"
    ]
  end
end
