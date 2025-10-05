<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">
	  <?php $this->load->view('templates/top_nav'); ?>
      

      <div class="container-fluid">
        <h3 class="mt-4">Add Agent</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("agents/add",$attributes);?>
			<input type="hidden" class="form-control" id="type" name="type" placeholder="friend" value="friend" required />
			<input type="hidden" class="form-control" id="host" name="host" placeholder="dynamic" value="dynamic" required />
			<input type="hidden" class="form-control" id="port" name="port" placeholder="5060" value="5060" required />
			<input type="hidden" class="form-control" id="dtmfmode" name="dtmfmode" value="rfc2833" required />
			<input type="hidden" class="form-control" id="insecure" name="insecure" placeholder="port,invite" value="port,invite" required />
			<input type="hidden" class="form-control" id="canreinvite" name="canreinvite" placeholder="no" value="no" required />
			<input type="hidden" class="form-control" id="call-limit" name="call-limit" placeholder="2" value="2" required />
			<input type="hidden" class="form-control" id="transport" name="transport" placeholder="udp,ws,tls,wss" value="udp,ws,tls,wss" required />
			<div class="row">
				<div class="form-group col">
					<label>Username</label>
					<input type="text" class="form-control" id="username" name="username" placeholder="Enter Username" required />
				</div>
				<div class="form-group col">
					<label>Password / Secret</label>
					<input class="form-control" id="secret" name="secret" placeholder="Enter Password / Secret" required />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>NAT</label>
					<input class="form-control" id="nat" name="nat" placeholder="force_rport,comedia" value="force_rport,comedia" required />					
				</div>
			</div>
			
			<button type="submit" class="btn btn-success btn-sm">Add Agent</button>
			<a href="<?php echo base_url();?>agents" class="btn btn-warning btn-sm">Cancel</a>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	
  </script>

</body>

</html>
