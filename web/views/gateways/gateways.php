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
        <h3 class="mt-4">Gateways <a href="<?php echo base_url();?>gateways/add" class="btn btn-success btn-sm float-right"><i class="fa fa-edit"></i> Add New</a></h2>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>Name</th>
				<th>Host</th>
				<th>Actions</th>
			</thead>
			<tbody>
				<?php foreach ($gateways as $gateway){ ?>
				<tr>
					<td><?php echo $gateway->name;?></td>
					<td><?php echo $gateway->host;?></td>
					<td>
						<a href="<?php echo base_url();?>gateways/edit/<?php echo $gateway->id;?>" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i> Edit</a>
						<a href="<?php echo base_url();?>gateways/delete/<?php echo $gateway->id;?>" class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
					</td>
				</tr>
				<?php } ?>
			</tbody>
		</table>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>

  <script>
	  $(document).ready(function(){
		$('#cdrs_table').DataTable();
	  });
  </script>
</body>

</html>
