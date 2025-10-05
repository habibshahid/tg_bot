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
        <h1 class="mt-4">DIDs <a href="<?php echo base_url();?>dids/add" class="btn btn-success btn-sm float-right"><i class="fa fa-edit"></i> Add New</a></h1>
		<h3 class="mt-4"><?php echo $this->session->flashdata('message');?></h3>
		
		<table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>DID</th>
				<th>Type</th>
				<th>Destination</th>
				<th>Actions</th>
			</thead>
			<tbody>
				<?php foreach ($dids as $did){ ?>
				<tr>
					<td><?php echo $did->did;?></td>
					<td><?php echo $did->type;?></td>
					<td><?php echo $did->destination;?></td>
					<td>
						<a href="<?php echo base_url();?>dids/edit/<?php echo $did->id;?>" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i> Edit</a>
						<a href="<?php echo base_url();?>dids/delete/<?php echo $did->id;?>" class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
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
