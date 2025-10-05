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
        <div class="row">
			<div class="col-md-12">
				<h3 class="mt-4">Credit Management - <?php echo $user->first_name . ' ' . $user->last_name . '(' . $user->telegram_id . ')'; ?></h3>
				<nav aria-label="breadcrumb">
					<ol class="breadcrumb">
						<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>clients">Clients</a></li>
						<li class="breadcrumb-item active">Credit Management</li>
					</ol>
				</nav>
				<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
			</div>
		</div>
		
		<!-- User Info Card -->
		<div class="row mb-4">
			<div class="col-md-12">
				<div class="card">
					<div class="card-header">
						<h5>User Information</h5>
					</div>
					<div class="card-body">
						<div class="row">
							<div class="col-md-3">
								<strong>Username / Telegram ID:</strong> <?php echo $user->username ? $user->username : $user->telegram_id; ?>
							</div>
							<div class="col-md-3">
								<strong>Email:</strong> <?php echo $user->email; ?>
							</div>
							<div class="col-md-3">
								<strong>Current Balance:</strong> 
								<span class="badge badge-<?php echo ($user->balance > 0) ? 'success' : 'danger'; ?> badge-lg">
									$<?php echo number_format($user->balance, 4); ?>
								</span>
							</div>
							<div class="col-md-3">
								<strong>Credit Limit:</strong> $<?php echo number_format($user->credit_limit, 4); ?>
							</div>
						</div>
						<div class="row mt-2">
							<div class="col-md-3">
								<strong>Rate Card:</strong> <?php echo $user->rate_card_name ?: 'Not Assigned'; ?>
							</div>
							<div class="col-md-3">
								<strong>Status:</strong> 
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
							</div>
							<div class="col-md-3">
								<strong>Currency:</strong> <?php echo $user->currency; ?>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Add Transaction Form -->
		<div class="row mb-4">
			<div class="col-md-6">
				<div class="card">
					<div class="card-header">
						<h5>Add Transaction</h5>
					</div>
					<div class="card-body">
						<?php $attributes = array('class'=>'form-transaction');
						echo form_open("clients/credit_management/".$user->id,$attributes);?>
							<div class="form-group">
								<label>Transaction Type <span class="text-danger">*</span></label>
								<select class="form-control" id="transaction_type" name="transaction_type" required>
									<option value="">Select Type</option>
									<option value="credit">Credit (Add Balance)</option>
									<option value="debit">Debit (Subtract Balance)</option>
									<option value="adjustment">Adjustment</option>
									<option value="refund">Refund</option>
								</select>
							</div>
							<div class="form-group">
								<label>Amount <span class="text-danger">*</span></label>
								<input class="form-control" id="amount" name="amount" type="number" step="0.0001" placeholder="Enter Amount" required />
							</div>
							<div class="form-group">
								<label>Reference</label>
								<input class="form-control" id="reference" name="reference" placeholder="Reference Number (Optional)" />
							</div>
							<div class="form-group">
								<label>Description <span class="text-danger">*</span></label>
								<textarea class="form-control" id="description" name="description" rows="3" placeholder="Enter Description" required></textarea>
							</div>
							<button type="submit" class="btn btn-success btn-sm">Add Transaction</button>
						<?php echo form_close();?>
					</div>
				</div>
			</div>
			
			<!-- Quick Actions -->
			<div class="col-md-6">
				<div class="card">
					<div class="card-header">
						<h5>Quick Actions</h5>
					</div>
					<div class="card-body">
						<div class="row">
							<div class="col-md-6 mb-3">
								<button class="btn btn-info btn-block quick-credit" data-amount="10.00">Add $10</button>
							</div>
							<div class="col-md-6 mb-3">
								<button class="btn btn-info btn-block quick-credit" data-amount="25.00">Add $25</button>
							</div>
							<div class="col-md-6 mb-3">
								<button class="btn btn-info btn-block quick-credit" data-amount="50.00">Add $50</button>
							</div>
							<div class="col-md-6 mb-3">
								<button class="btn btn-info btn-block quick-credit" data-amount="100.00">Add $100</button>
							</div>
						</div>
						<hr>
						<div class="row">
							<div class="col-md-12">
								<a href="<?php echo base_url(); ?>clients/assign_rate_card/<?php echo $user->id; ?>" class="btn btn-primary btn-block">
									<i class="fa fa-credit-card"></i> Assign Rate Card
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Transaction History -->
		<div class="row">
			<div class="col-md-12">
				<div class="card">
					<div class="card-header">
						<h5>Transaction History</h5>
					</div>
					<div class="card-body">
						<table id="transactions_table" class="table table-striped table-bordered" style="width:100%">
							<thead>
								<tr>
									<th>Date</th>
									<th>Type</th>
									<th>Amount</th>
									<th>Balance Before</th>
									<th>Balance After</th>
									<th>Reference</th>
									<th>Description</th>
									<th>Created By</th>
								</tr>
							</thead>
							<tbody>
								<?php foreach ($transactions as $transaction){ ?>
								<tr>
									<td><?php echo date('Y-m-d H:i:s', strtotime($transaction->created_at));?></td>
									<td>
										<span class="badge badge-<?php 
											switch($transaction->transaction_type) {
												case 'credit': echo 'success'; break;
												case 'debit': echo 'danger'; break;
												case 'refund': echo 'warning'; break;
												case 'adjustment': echo 'info'; break;
												default: echo 'secondary';
											}
										?>">
											<?php echo ucfirst($transaction->transaction_type);?>
										</span>
									</td>
									<td>
										<span class="<?php echo ($transaction->transaction_type == 'credit' || $transaction->transaction_type == 'refund') ? 'text-success' : 'text-danger'; ?>">
											<?php echo ($transaction->transaction_type == 'credit' || $transaction->transaction_type == 'refund') ? '+' : '-'; ?>
											$<?php echo number_format($transaction->amount, 4);?>
										</span>
									</td>
									<td>$<?php echo number_format($transaction->balance_before ?: 0, 4);?></td>
									<td>$<?php echo number_format($transaction->balance_after ?: 0, 4);?></td>
									<td><?php echo $transaction->reference ?: '-';?></td>
									<td><?php echo $transaction->description;?></td>
									<td><?php echo $transaction->created_by ?: 'System';?></td>
								</tr>
								<?php } ?>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
		
		<div class="row mt-3">
			<div class="col-md-12">
				<a href="<?php echo base_url();?>clients" class="btn btn-warning btn-sm">Back to Clients</a>
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
		$('#transactions_table').DataTable({
			"order": [[ 0, "desc" ]],
			"pageLength": 25,
			"responsive": true
		});
		
		// Quick credit buttons
		$('.quick-credit').click(function(){
			var amount = $(this).data('amount');
			$('#transaction_type').val('credit');
			$('#amount').val(amount);
			$('#description').val('Quick credit addition of $' + amount);
			$('#reference').val('QUICK-' + Date.now());
		});
	});
  </script>

</body>

</html>