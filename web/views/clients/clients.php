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
        <h3 class="mt-4">User Management <a href="<?php echo base_url();?>clients/add" class="btn btn-success btn-sm float-right"><i class="fa fa-plus"></i> Add New User</a></h3>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<!-- User Statistics Cards -->
		<div class="row mb-4">
			<div class="col-xl-3 col-md-6">
				<div class="card bg-primary text-white mb-4">
					<div class="card-body">
						<h4><?php echo count($users); ?></h4>
						<p>Total Users</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-success text-white mb-4">
					<div class="card-body">
						<h4><?php echo count(array_filter($users, function($u) { return $u->status == 'active'; })); ?></h4>
						<p>Active Users</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-info text-white mb-4">
					<div class="card-body">
						<h4><?php echo count(array_filter($users, function($u) { return $u->balance > 0; })); ?></h4>
						<p>Users with Balance</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-warning text-white mb-4">
					<div class="card-body">
						<h4>$<?php echo number_format(array_sum(array_column($users, 'balance')), 2); ?></h4>
						<p>Total Balance</p>
					</div>
				</div>
			</div>
		</div>
		
		<table id="users_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<tr>
					<th>Username</th>
					<th>Name</th>
					<th>Destination</th>
					<th>Balance</th>
					<th>Rate Card</th>
					<th>Status</th>
					<th>Total Calls</th>
					<th>Total Spent</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ($users as $user){ ?>
				<tr>
					<td><?php echo $user->username ? $user->username : $user->telegram_id;?></td>
					<td><?php echo $user->first_name . ' ' . $user->last_name;?></td>
					<td><?php echo $user->destination_route;?></td>
					<td>
						<span class="badge badge-<?php echo ($user->balance > 0) ? 'success' : 'danger'; ?>">
							$<?php echo number_format($user->balance, 4);?>
						</span>
					</td>
					<td><?php echo $user->rate_card_name ?: 'Not Assigned';?></td>
					<td>
						<span class="badge badge-<?php 
							switch($user->status) {
								case 'active': echo 'success'; break;
								case 'suspended': echo 'warning'; break;
								case 'inactive': echo 'secondary'; break;
								default: echo 'secondary';
							}
						?>">
							<?php echo ucfirst($user->status);?>
						</span>
					</td>
					<td><?php echo $user->total_calls ?: 0;?></td>
					<td>$<?php echo number_format($user->total_spent ?: 0, 4);?></td>
					<td>
						<div class="btn-group" role="group">
							<a href="<?php echo base_url();?>clients/edit/<?php echo $user->id;?>" class="btn btn-warning btn-sm" title="Edit User">
								<i class="fa fa-edit"></i>
							</a>
							<a href="<?php echo base_url();?>clients/manage_agents/<?php echo $user->id;?>" class="btn btn-info btn-sm" title="Manage Agents">
								<i class="fa fa-users"></i>
							</a>
							<a href="<?php echo base_url();?>clients/credit_management/<?php echo $user->id;?>" class="btn btn-info btn-sm" title="Manage Credit">
								<i class="fa fa-money"></i>
							</a>
							<a href="<?php echo base_url();?>clients/assign_rate_card/<?php echo $user->id;?>" class="btn btn-primary btn-sm" title="Assign Rate Card">
								<i class="fa fa-credit-card"></i>
							</a>
							<a href="<?php echo base_url();?>clients/delete/<?php echo $user->id;?>" class="btn btn-danger btn-sm" title="Delete User">
								<i class="fa fa-times"></i>
							</a>
						</div>
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
		$('#users_table').DataTable({
			"order": [[ 0, "asc" ]],
			"pageLength": 25,
			"responsive": true,
			"columnDefs": [
				{ "orderable": false, "targets": 8 } // Disable sorting on Actions column
			]
		});
	  });
  </script>
</body>

</html>