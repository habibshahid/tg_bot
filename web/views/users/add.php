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
        <h3 class="mt-4">Add User</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("users/add",$attributes);?>
			<div class="form-group">
				<input class="form-control" id="username" name="username" placeholder="Enter Username" required />
			</div>
			<div class="form-group">
				<input class="form-control" id="password" name="password" placeholder="Enter Password" type="password" required/>
			</div>
			<div class="form-group">
				<input class="form-control" id="email" name="email" placeholder="Enter Email" type="email" required/>
			</div>
			<div class="form-group">
				<select class="form-control" id="type" name="type" required/>
					<option value="0">Admin</option>
					<option value="1">User</option>
				</select>
			</div>
			<button type="submit" class="btn btn-success btn-sm">Add User</button>
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
