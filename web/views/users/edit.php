<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <<?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">
      <?php $this->load->view('templates/top_nav'); ?>

      <div class="container-fluid">
        <h3 class="mt-4">Edit User</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("users/edit",$attributes);?>
			<div class="form-group">
				<input class="form-control" id="username" name="username" placeholder="Enter Username" required value="<?php echo $fields->username;?>"/>
			</div>
			<div class="form-group">
				<input class="form-control" id="password" name="password" placeholder="Enter New Password" type="password" required value="<?php echo $fields->password;?>"/>
			</div>
			<div class="form-group">
				<input class="form-control" id="email" name="email" placeholder="Enter Email" required value="<?php echo $fields->email;?>"/>
			</div>
			<div class="form-group">
				<select class="form-control" id="type" name="type" required/>
					<option value="0" <?php if($fields->type == 0){echo 'selected="selected"';}?>>Admin</option>
					<option value="1" <?php if($fields->type == 1){echo 'selected="selected"';}?>>User</option>
				</select>
			</div>
			<input type='hidden' id="id" name="id" value="<?php echo $fields->id; ?>" />
			<button type="submit" class="btn btn-success btn-sm">Save User</button>
			<a href="<?php echo base_url();?>users" class="btn btn-warning btn-sm">Cancel</a>
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
