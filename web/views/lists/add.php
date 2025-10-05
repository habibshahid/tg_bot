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
        <h3 class="mt-4">Add Forwarding Route</h3>
        <?php $attributes = array('class'=>'form-signin');
		echo form_open("lists/add",$attributes);?>
			<div class="row">
				<div class="form-group col">
					<label>Destination Name</label>
					<input class="form-control" id="list_name" name="list_name" placeholder="Enter List Name" required />
				</div>
				 <div class="form-group col">
					<label>Caller ID</label>
					<input class="form-control" id="callerid" name="callerid" placeholder="Enter Caller Id" value="<?php echo $fields->callerid; ?>" required />
				</div>
			</div>
			<div class="row">

				<div class="form-group col">
					<label>Gateway</label>
					<select class="form-control" id="gateway_name" name="gateway_name" required />
						<option value="">Select Gateway</option>
						<?php foreach($gateways as $gateway){ ?>
						<option value="<?php echo $gateway->name;?>"><?php echo $gateway->name;?></option>
						<?php } ?>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Music on Hold</label>
					<select class="form-control" id="moh_name" name="moh_name" required />
						<option value="">Select MOH Class</option>
						<?php foreach($mohs as $moh) { ?>
						<option value="<?php echo $moh->name;?>"><?php echo $moh->name;?></option>
						<?php } ?>
					</select>
				</div>
				<div class="form-group col">
					<label>IVR</label>
					<select class="form-control" id="ivr_id" name="ivr_id" required />
						<option value="">Select IVR</option>
						<?php foreach($ivrs as $ivr) { ?>
						<option value="<?php echo $ivr->id;?>"><?php echo $ivr->ivr_name;?></option>
						<?php } ?>
					</select>
				</div>
				<div class="form-group col">
                    <label>Routing</label>
					<select class="form-control" id="route_queue" name="route_queue" required />
						<option value="0">>Route to Admin Mobile</option>
						<option value="1">Route to Admin SIP</option>
						<option value="2">Route to Admin SIP Trunk</option>
						<option value="3">Route to Admin SIP Trunk with IVR</option>
						<option value="4">Route to Admin SIP Trunk with IVR Input</option>
					</select>
                </div>
			</div>
			<button type="submit" class="btn btn-success btn-sm">Add List</button>
			<a href="<?php echo base_url();?>lists" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  <script>
	  $('input').on('keypress', function (event) {
		var regex = new RegExp("^[a-zA-Z0-9]+$");
		var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
		if (!regex.test(key)) {
		   event.preventDefault();
		   return false;
		}
	  });
  </script>
</body>

</html>
