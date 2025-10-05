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
        <h3 class="mt-4">Add Gateway</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("gateways/add",$attributes);?>
			<div class="row">
				<div class="form-group col">
					<label>Name</label>
					<input class="form-control" id="name" name="name" placeholder="Enter Name" required />
				</div>
				<div class="form-group col">
					<label>Type</label>
					<select class="form-control" id="type" name="type" required />
						<option value="">Select Type</option>
						<option value="peer" selected>Peer</option>
						<option value="friend">Friend</option>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Host <small><i>IP Address</i></small></label>
					<input class="form-control" id="host" name="host" placeholder="Enter Host" required />
				</div>
				<div class="form-group col">
					<label>Port</label>
					<input class="form-control" id="port" name="port" placeholder="5060" value="5060" required />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Username</label>
					<input class="form-control" id="username" name="username" placeholder="Enter Username" />
				</div>
				<div class="form-group col">
					<label>Password / Secret</label>
					<input class="form-control" id="secret" name="secret" placeholder="Enter Password / Secret" />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Transport</label>
					<input class="form-control" id="transport" name="transport" placeholder="udp" value="<?php echo $fields->transport;?>" required />
				</div>
				<div class="form-group col">
					<label>NAT</label>
					<input class="form-control" id="nat" name="nat" placeholder="force_rport,comedia" value="force_rport,comedia" required />
				</div>
				<div class="form-group col">
					<label>DTMF Mode</label>
					<input class="form-control" id="dtmfmode" name="dtmfmode" value="rfc2833" required />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Insecure</label>
					<input class="form-control" id="insecure" name="insecure" placeholder="port,invite" value="port,invite" required />
				</div>
				<div class="form-group col">
					<label>Can Reinvite</label>
					<select class="form-control" id="canreinvite" name="canreinvite" required />
						<option value="">Select Type</option>
						<option value="no" selected>No</option>
						<option value="yes">Yes</option>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Outbound Proxy</label>
					<input class="form-control" id="outboundproxy" name="outboundproxy" />
				</div>
				
				<div class="form-group col">
					<label>From Domain</label>
					<input class="form-control" id="fromdomain" name="fromdomain" value="" />
				</div>
			</div>
			<div class="row">	
				<div class="form-group col">
					<label>Send RPID</label>
					<select class="form-control" id="sendrpid" name="sendrpid" required />
						<option value="">Select Type</option>
						<option value="no" selected>No</option>
						<option value="yes">Yes</option>
						<option value="pai">pai</option>
					</select>
				</div>
				
				<div class="form-group col">
					<label>Trust RPID</label>
					<select class="form-control" id="trustrpid" name="trustrpid" required />
						<option value="">Select Type</option>
						<option value="no" selected>No</option>
						<option value="yes">Yes</option>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Call Limit</label>
					<select class="form-control" id="call-limit" name="call-limit" required />
						<?php for($x=0; $x < 101; $x++){ ?>
						<option value="<?php echo $x;?>"><?php echo $x;?></option>
						<?php } ?>
					</select>
				</div>
				<div class="form-group col">
					<label>Register Trunk</label>
					<select class="form-control" id="register_trunk" name="register_trunk" required />
						<option value="">Select Type</option>
						<option value="no">No</option>
						<option value="yes">Yes</option>
					</select>
				</div>
			</div>
			<button type="submit" class="btn btn-success btn-sm">Add Gateway</button>
			<a href="<?php echo base_url();?>gateways" class="btn btn-warning btn-sm">Cancel</a>
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
