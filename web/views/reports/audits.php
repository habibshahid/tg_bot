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
        <h3 class="mt-4"><table border="0" width="100%"><tr><td>Audit Reports</td><td align="right"><!--<button class="btn btn-success btn-sm">Export</button>--></td></td></table></h3>
        <table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>Call Date</th>
				<th>Username</th>
				<th>IP Address</th>
				<th>Module</th>
				<th>Function</th>
				<th>Data</th>
			</thead>
			<tbody>
				<?php foreach ($audits as $cdr){ ?>
				<tr>
					<td><?php echo $cdr->created_at;?></td>
					<td><?php echo $cdr->username;?></td>
					<td><?php echo $cdr->ip_address;?></td>
					<td><?php echo $cdr->controller;?></td>
					<td><?php echo $cdr->view;?></td>
					<td><?php print_r(($cdr->data));?></td>
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
