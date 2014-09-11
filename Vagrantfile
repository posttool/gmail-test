Vagrant::Config.run do |config|

  config.vm.box = "precise32"
  
  config.vm.box_url = "http://files.vagrantup.com/precise32.box"

  config.vm.forward_port 3002, 3002
  config.vm.customize ["modifyvm", :id, "--memory", 4196]
  config.vm.customize ["modifyvm", :id, "--cpus", 2]
  config.vm.customize ["modifyvm", :id, "--cpuexecutioncap", 100]
  config.vm.network :hostonly, "10.11.12.25"

  config.vm.share_folder "currently13", "/home/currently13", "../currently13"
  config.vm.share_folder "app", "/home/vagrant/app", "app"
  config.vm.share_folder "deploy", "/home/vagrant/deploy", "deploy"

  config.vm.provision :shell, :path => "deploy/provision.sh"

end
