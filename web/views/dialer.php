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
        <h3 class="mt-4">Dialer <h5><?php echo $this->session->flashdata('message');?></h5></h3>
		
        <?php $attributes = array('class'=>'form-signin');
		echo form_open("dialer/dial",$attributes);?>
			<div class="row">
				<div class="form-group col">
					<label>Customer</label>
					<input class="form-control" id="customer_number" name="customer_number" placeholder="Enter Customer Number" value="" required />
				</div>
				<div class="form-group col">
					<label>Branch</label>
					<input class="form-control" id="branch_number" name="branch_number" placeholder="Enter Branch Number" value="" />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Admin</label>
					<input class="form-control" id="admin_number" name="admin_number" placeholder="Enter Admin Number" value="" required />
				</div>
				<div class="form-group col">
					<label>Caller Id</label>
					<input class="form-control" id="callerid" name="callerid" placeholder="Caller ID" value="" required />
				</div>
			</div>
			<div class="row">
				<div class="form-group col">
					<label>Gateway</label>
					<select class="form-control" id="gateway" name="gateway" required />
						<option value="">Select Gateway</option>
						<?php foreach($gateways as $gateway){ ?>
						<option value="<?php echo $gateway->name;?>"><?php echo $gateway->name;?></option>
						<?php } ?>
					</select>
				</div>
				<!--<div class="form-group col">
					<label>Dial List</label>
					<select class="form-control" id="listid" name="listid" required />
						<option value="">Select List</option>
						<?php //foreach($lists as $list) { ?>
						<option value="<?php //echo $list->id;?>"><?php //echo $list->list_name;?></option>
						<?php //} ?>
					</select>
				</div>-->
			</div>
			<div class="row">
				<div class="form-group col">
					<label>MOH</label>
					<select class="form-control" id="moh_name" name="moh_name" required />
						<option value="default">Default</option>
						<?php foreach($mohs as $moh) { ?>
						<option value="<?php echo $moh->name;?>"><?php echo $moh->name;?></option>
						<?php } ?>
					</select>
				</div>
			</div>
			<button type="submit" class="btn btn-success btn-sm">Dial Now</button>
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
