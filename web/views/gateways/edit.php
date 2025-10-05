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
        <h3 class="mt-4">Edit Gateway</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("gateways/edit",$attributes);?>
			<div class="row">
				<div class="form-group col">
					<label>Name</label>
					<input class="form-control" id="name" name="name" placeholder="Enter Name" value="<?php echo $fields->name;?>" required />
				</div>
				<div class="form-group col">
					<label>Type</label>
					<select class="form-control" id="type" name="type" required />
						<option value="">Select Type</option>
						<option value="peer" <?php if($fields->type == 'peer'){echo 'selected="selected"';}?>>Peer</option>
						<option value="friend" <?php if($fields->type == 'friend'){echo 'selected="selected"';}?>>Friend</option>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Host <small><i>IP Address</i></small></label>
					<input class="form-control" id="host" name="host" placeholder="Enter Host" value="<?php echo $fields->host;?>" required />
				</div>
				<div class="form-group col">
					<label>Port</label>
					<input class="form-control" id="port" name="port" placeholder="5060" value="<?php echo $fields->port;?>" required />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Username</label>
					<input class="form-control" id="username" name="username" placeholder="Enter Username" value="<?php echo $fields->username;?>" />
				</div>
				<div class="form-group col">
					<label>Password / Secret</label>
					<input class="form-control" id="secret" name="secret" placeholder="Enter Password / Secret" value="<?php echo $fields->secret;?>" />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Transport</label>
					<input class="form-control" id="transport" name="transport" placeholder="udp" value="<?php echo $fields->transport;?>" required />
				</div>
				<div class="form-group col">
					<label>NAT</label>
					<input class="form-control" id="nat" name="nat" placeholder="force_rport,comedia" value="<?php echo $fields->nat;?>" required />
				</div>
				<div class="form-group col">
					<label>DTMF Mode</label>
					<input class="form-control" id="dtmfmode" name="dtmfmode" value="<?php echo $fields->dtmfmode;?>" required />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Insecure</label>
					<input class="form-control" id="insecure" name="insecure" placeholder="port,invite" value="<?php echo $fields->insecure;?>" required />
				</div>
				<div class="form-group col">
					<label>Can Reinvite</label>
					<select class="form-control" id="canreinvite" name="canreinvite" required />
						<option value="">Select Type</option>
						<option value="no" <?php if($fields->canreinvite == 'no'){echo 'selected="selected"';}?>>No</option>
						<option value="yes" <?php if($fields->canreinvite == 'yes'){echo 'selected="selected"';}?>>Yes</option>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Outbound Proxy</label>
					<input class="form-control" id="outboundproxy" name="outboundproxy" value="<?php echo $fields->outboundproxy;?>" />
				</div>
				
				<div class="form-group col">
					<label>From Domain</label>
					<input class="form-control" id="fromdomain" name="fromdomain" value="<?php echo $fields->fromdomain;?>" />
				</div>
			</div>
			<div class="row">	
				<div class="form-group col">
					<label>Send RPID</label>
					<select class="form-control" id="sendrpid" name="sendrpid" required />
						<option value="">Select Type</option>
						<option value="no"<?php if($fields->sendrpid == 'no'){echo 'selected="selected"';}?>>No</option>
						<option value="yes"<?php if($fields->sendrpid == 'yes'){echo 'selected="selected"';}?>>Yes</option>
						<option value="pai"<?php if($fields->sendrpid == 'pai'){echo 'selected="selected"';}?>>pai</option>
					</select>
				</div>
				
				<div class="form-group col">
					<label>Trust RPID</label>
					<select class="form-control" id="trustrpid" name="trustrpid" required />
						<option value="">Select Type</option>
						<option value="no"<?php if($fields->trustrpid == 'no'){echo 'selected="selected"';}?>>No</option>
						<option value="yes"<?php if($fields->trustrpid == 'yes'){echo 'selected="selected"';}?>>Yes</option>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Call Limit</label>
					<select class="form-control" id="call-limit" name="call-limit" required />
						<?php for($x=0; $x < 101; $x++){ ?>
						<option value="<?php echo $x;?>" <?php if($fields->{'call-limit'} == $x){echo 'selected="selected"';}?>><?php echo $x;?></option>
						<?php } ?>
					</select>
				</div>
				<div class="form-group col">
					<label>Register Trunk</label>
					<select class="form-control" id="register_trunk" name="register_trunk" required />
						<option value="">Select Type</option>
						<option value="no" <?php if($fields->register_string == ''){echo 'selected="selected"';}?>>No</option>
						<option value="yes" <?php if($fields->register_string != ''){echo 'selected="selected"';}?>>Yes</option>
					</select>
				</div>
			</div>
			<input class="form-control" type="hidden" id="gateway_id" name="gateway_id" value="<?php echo $fields->id;?>" />
			<button type="submit" class="btn btn-success btn-sm">Update Gateway</button>
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
