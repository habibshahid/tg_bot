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
        <h3 class="mt-4">Delete Client - <?php echo $fields->first_name . ' ' . $fields->last_name . '(' . $fields->telegram_id ')'; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>clients">Clients</a></li>
				<li class="breadcrumb-item active">Delete Client</li>
			</ol>
		</nav>
		
		<div class="alert alert-danger" role="alert">
			<h4 class="alert-heading">Warning!</h4>
			<p>You are about to permanently delete this client account. This action cannot be undone.</p>
			<hr>
			<p class="mb-0">All associated data including call details, transactions, and other records will also be affected.</p>
		</div>
		
		<!-- User Information Card -->
		<div class="card mb-4">
			<div class="card-header bg-danger text-white">
				<h5>Client Information to be Deleted</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-6">
						<table class="table table-borderless">
							<tr>
								<td><strong>Username:</strong></td>
								<td><?php echo $fields->username; ?></td>
							</tr>
							<tr>
								<td><strong>Full Name:</strong></td>
								<td><?php echo $fields->first_name . ' ' . $fields->last_name . '(' . $fields->telegram_id . ')'; ?></td>
							</tr>
							<tr>
								<td><strong>Email:</strong></td>
								<td><?php echo $fields->email; ?></td>
							</tr>
							<tr>
								<td><strong>User Type:</strong></td>
								<td>
									<span class="badge badge-<?php echo ($fields->user_type == 'admin') ? 'warning' : 'info'; ?>">
										<?php echo ucfirst($fields->user_type); ?>
									</span>
								</td>
							</tr>
							<tr>
								<td><strong>Status:</strong></td>
								<td>
									<span class="badge badge-<?php 
										switch($fields->status) {
											case 'active': echo 'success'; break;
											case 'suspended': echo 'warning'; break;
											case 'inactive': echo 'secondary'; break;
											default: echo 'secondary';
										}
									?>">
										<?php echo ucfirst($fields->status);?>
									</span>
								</td>
							</tr>
						</table>
					</div>
					<div class="col-md-6">
						<table class="table table-borderless">
							<tr>
								<td><strong>Current Balance:</strong></td>
								<td>
									<span class="badge badge-<?php echo ($fields->balance > 0) ? 'success' : 'danger'; ?> badge-lg">
										$<?php echo number_format($fields->balance, 4); ?>
									</span>
								</td>
							</tr>
							<tr>
								<td><strong>Credit Limit:</strong></td>
								<td>$<?php echo number_format($fields->credit_limit, 4); ?></td>
							</tr>
							<tr>
								<td><strong>Rate Card:</strong></td>
								<td><?php echo $fields->rate_card_name ?: 'Not Assigned'; ?></td>
							</tr>
							<tr>
								<td><strong>Telegram ID:</strong></td>
								<td><?php echo $fields->telegram_id ?: 'Not Set'; ?></td>
							</tr>
							<tr>
								<td><strong>Member Since:</strong></td>
								<td><?php echo date('Y-m-d', strtotime($fields->created_at)); ?></td>
							</tr>
						</table>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Impact Analysis Card -->
		<div class="card mb-4">
			<div class="card-header bg-warning text-dark">
				<h5>Deletion Impact Analysis</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-12">
						<h6>The following data will be affected:</h6>
						<ul class="list-group list-group-flush">
							<li class="list-group-item d-flex justify-content-between align-items-center">
								Call Detail Records (CDRs)
								<span class="badge badge-danger badge-pill">All records will reference null user</span>
							</li>
							<li class="list-group-item d-flex justify-content-between align-items-center">
								Transaction History
								<span class="badge badge-danger badge-pill">All records will be deleted</span>
							</li>
							<li class="list-group-item d-flex justify-content-between align-items-center">
								User Sessions
								<span class="badge badge-warning badge-pill">All active sessions will be terminated</span>
							</li>
							<li class="list-group-item d-flex justify-content-between align-items-center">
								Account Balance
								<span class="badge badge-<?php echo ($fields->balance > 0) ? 'danger' : 'success'; ?> badge-pill">
									$<?php echo number_format($fields->balance, 4); ?> will be lost
								</span>
							</li>
						</ul>
					</div>
				</div>
				
				<?php if($fields->balance > 0): ?>
				<div class="alert alert-warning mt-3">
					<strong>Balance Warning:</strong> This user has a positive balance of $<?php echo number_format($fields->balance, 4); ?>. 
					Consider transferring this balance or issuing a refund before deletion.
				</div>
				<?php endif; ?>
				
				<?php if($fields->user_type == 'admin'): ?>
				<div class="alert alert-danger mt-3">
					<strong>Admin Account Warning:</strong> This is an administrator account. Deleting this account may affect system administration capabilities. 
					Ensure other admin accounts are available.
				</div>
				<?php endif; ?>
			</div>
		</div>
		
		<!-- Confirmation Form -->
		<div class="card mb-4">
			<div class="card-header bg-dark text-white">
				<h5>Deletion Confirmation</h5>
			</div>
			<div class="card-body">
				<?php $attributes = array('class'=>'form-delete', 'onsubmit'=>'return confirmDelete()');
				echo form_open("clients/delete/".$fields->id,$attributes);?>
				<input type="hidden" name="id" value="<?php echo $fields->id; ?>">
				
				<div class="form-group">
					<label for="confirmation">Type <strong>"DELETE"</strong> to confirm deletion:</label>
					<input type="text" class="form-control" id="confirmation" name="confirmation" placeholder="Type DELETE to confirm" required>
				</div>
				
				<div class="form-check mb-3">
					<input class="form-check-input" type="checkbox" id="understand_warning" name="understand_warning" required>
					<label class="form-check-label" for="understand_warning">
						I understand that this action cannot be undone and all associated data will be permanently deleted.
					</label>
				</div>
				
				<div class="form-group">
					<label for="deletion_reason">Reason for Deletion (Optional):</label>
					<textarea class="form-control" id="deletion_reason" name="deletion_reason" rows="3" placeholder="Enter reason for deleting this user account..."></textarea>
				</div>
				
				<hr>
				<div class="row">
					<div class="col-md-12">
						<button type="submit" class="btn btn-danger btn-sm" id="deleteBtn" disabled>
							<i class="fa fa-trash"></i> Permanently Delete User
						</button>
						<a href="<?php echo base_url();?>clients" class="btn btn-secondary btn-sm">Cancel</a>
						<a href="<?php echo base_url();?>clients/edit/<?php echo $fields->id; ?>" class="btn btn-warning btn-sm">Edit Instead</a>
					</div>
				</div>
				<?php echo form_close();?>
			</div>
		</div>
		
		<!-- Alternative Actions -->
		<div class="card mb-4">
			<div class="card-header bg-info text-white">
				<h5>Alternative Actions</h5>
			</div>
			<div class="card-body">
				<p>Instead of deleting this user, you might consider:</p>
				<div class="row">
					<div class="col-md-4">
						<a href="<?php echo base_url();?>clients/edit/<?php echo $fields->id; ?>" class="btn btn-warning btn-block">
							<i class="fa fa-edit"></i> Suspend Account
						</a>
						<small class="text-muted">Temporarily disable access</small>
					</div>
					<div class="col-md-4">
						<a href="<?php echo base_url();?>clients/credit_management/<?php echo $fields->id; ?>" class="btn btn-info btn-block">
							<i class="fa fa-money"></i> Withdraw Balance
						</a>
						<small class="text-muted">Remove remaining balance first</small>
					</div>
					<div class="col-md-4">
						<a href="<?php echo base_url();?>clients/edit/<?php echo $fields->id; ?>" class="btn btn-secondary btn-block">
							<i class="fa fa-ban"></i> Deactivate
						</a>
						<small class="text-muted">Mark as inactive instead</small>
					</div>
				</div>
			</div>
		</div>
		
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	$(document).ready(function(){
		// Enable delete button only when confirmation is typed correctly
		$('#confirmation').keyup(function(){
			var confirmation = $(this).val();
			var checkbox = $('#understand_warning').is(':checked');
			
			if(confirmation === 'DELETE' && checkbox){
				$('#deleteBtn').prop('disabled', false);
				$('#deleteBtn').removeClass('btn-secondary').addClass('btn-danger');
			} else {
				$('#deleteBtn').prop('disabled', true);
				$('#deleteBtn').removeClass('btn-danger').addClass('btn-secondary');
			}
		});
		
		$('#understand_warning').change(function(){
			var confirmation = $('#confirmation').val();
			var checkbox = $(this).is(':checked');
			
			if(confirmation === 'DELETE' && checkbox){
				$('#deleteBtn').prop('disabled', false);
				$('#deleteBtn').removeClass('btn-secondary').addClass('btn-danger');
			} else {
				$('#deleteBtn').prop('disabled', true);
				$('#deleteBtn').removeClass('btn-danger').addClass('btn-secondary');
			}
		});
	});
	
	function confirmDelete(){
		var confirmation = $('#confirmation').val();
		if(confirmation !== 'DELETE'){
			alert('Please type "DELETE" in the confirmation field to proceed.');
			return false;
		}
		
		var username = '<?php echo $fields->username; ?>';
		var balance = <?php echo $fields->balance; ?>;
		
		var message = 'Are you absolutely sure you want to delete user "' + username + '"?\n\n';
		message += 'This action CANNOT be undone!\n\n';
		
		if(balance > 0){
			message += 'WARNING: User has a balance of $' + balance.toFixed(4) + ' that will be lost!\n\n';
		}
		
		message += 'Click OK to proceed with deletion.';
		
		return confirm(message);
	}
  </script>

</body>

</html>