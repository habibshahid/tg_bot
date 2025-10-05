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
        <h3 class="mt-4">Edit Provider - <?php echo $fields->name; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>providers">Providers</a></li>
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>providers/view/<?php echo $fields->id; ?>"><?php echo $fields->name; ?></a></li>
				<li class="breadcrumb-item active">Edit</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("providers/edit/".$fields->id,$attributes);?>
		<input type="hidden" name="provider_id" value="<?php echo $fields->id; ?>">
		
			<!-- Current Provider Information -->
			<div class="card mb-4">
				<div class="card-header bg-info text-white">
					<h5>Current Provider Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-3">
							<div class="card bg-primary text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->name; ?></h4>
									<p>Provider Name</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-success text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->currency; ?></h4>
									<p>Currency</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-warning text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->total_rate_cards ?: 0; ?></h4>
									<p>Rate Cards</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-info text-white">
								<div class="card-body text-center">
									<h4><?php echo ucfirst($fields->status); ?></h4>
									<p>Status</p>
								</div>
							</div>
						</div>
					</div>
					
					<div class="row mt-3">
						<div class="col-md-12">
							<table class="table table-borderless">
								<tr>
									<td><strong>Created:</strong></td>
									<td><?php echo date('Y-m-d H:i:s', strtotime($fields->created_at)); ?></td>
									<td><strong>Last Updated:</strong></td>
									<td><?php echo date('Y-m-d H:i:s', strtotime($fields->updated_at)); ?></td>
								</tr>
								<tr>
									<td><strong>Billing Increment:</strong></td>
									<td><?php echo $fields->billing_increment; ?> seconds</td>
									<td><strong>Minimum Duration:</strong></td>
									<td><?php echo $fields->minimum_duration; ?> seconds</td>
								</tr>
							</table>
							
							<?php if($fields->description): ?>
							<div class="mt-2">
								<strong>Current Description:</strong>
								<p class="text-muted"><?php echo $fields->description; ?></p>
							</div>
							<?php endif; ?>
						</div>
					</div>
				</div>
			</div>
		
			<!-- Basic Information -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Basic Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Provider Name <span class="text-danger">*</span></label>
							<input class="form-control" id="name" name="name" placeholder="Enter Provider Name" value="<?php echo set_value('name', $fields->name); ?>" required />
							<small class="form-text text-muted">Choose a unique name for this provider</small>
						</div>
						<div class="form-group col-md-6">
							<label>Status <span class="text-danger">*</span></label>
							<select class="form-control" id="status" name="status" required onchange="showStatusWarning(this.value)">
								<option value="active" <?php echo set_select('status', 'active', ($fields->status == 'active')); ?>>Active</option>
								<option value="inactive" <?php echo set_select('status', 'inactive', ($fields->status == 'inactive')); ?>>Inactive</option>
							</select>
							<small class="form-text text-muted">Status affects all rate cards from this provider</small>
						</div>
					</div>
					
					<div class="row">
						<div class="form-group col-md-12">
							<label>Description</label>
							<textarea class="form-control" id="description" name="description" rows="3" placeholder="Enter description for this provider..."><?php echo set_value('description', $fields->description); ?></textarea>
							<small class="form-text text-muted">Optional: Describe the provider's services or purpose</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Billing Configuration -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Billing Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Default Currency <span class="text-danger">*</span></label>
							<select class="form-control" id="currency" name="currency" required onchange="updateCurrencyInfo(this.value)">
								<option value="">Select Currency</option>
								<option value="USD" <?php echo set_select('currency', 'USD', ($fields->currency == 'USD')); ?>>USD - US Dollar</option>
								<option value="EUR" <?php echo set_select('currency', 'EUR', ($fields->currency == 'EUR')); ?>>EUR - Euro</option>
								<option value="GBP" <?php echo set_select('currency', 'GBP', ($fields->currency == 'GBP')); ?>>GBP - British Pound</option>
								<option value="PKR" <?php echo set_select('currency', 'PKR', ($fields->currency == 'PKR')); ?>>PKR - Pakistani Rupee</option>
								<option value="AED" <?php echo set_select('currency', 'AED', ($fields->currency == 'AED')); ?>>AED - UAE Dirham</option>
								<option value="CAD" <?php echo set_select('currency', 'CAD', ($fields->currency == 'CAD')); ?>>CAD - Canadian Dollar</option>
								<option value="AUD" <?php echo set_select('currency', 'AUD', ($fields->currency == 'AUD')); ?>>AUD - Australian Dollar</option>
								<option value="INR" <?php echo set_select('currency', 'INR', ($fields->currency == 'INR')); ?>>INR - Indian Rupee</option>
							</select>
							<div class="alert alert-warning mt-2">
								<small><strong>Warning:</strong> Changing currency may affect existing rate cards and billing.</small>
							</div>
						</div>
						<div class="form-group col-md-6">
							<div id="currency_info">
								<div class="alert alert-info">
									<strong>Currency Symbol:</strong> <span id="currency_symbol"><?php 
										$symbols = array('USD' => '$', 'EUR' => '€', 'GBP' => '£', 'PKR' => '₨', 'AED' => 'د.إ', 'CAD' => 'C$', 'AUD' => 'A$', 'INR' => '₹');
										echo $symbols[$fields->currency] ?? $fields->currency;
									?></span><br>
									<strong>Currency Name:</strong> <span id="currency_name"><?php 
										$names = array('USD' => 'US Dollars', 'EUR' => 'Euros', 'GBP' => 'British Pounds', 'PKR' => 'Pakistani Rupees', 'AED' => 'UAE Dirhams', 'CAD' => 'Canadian Dollars', 'AUD' => 'Australian Dollars', 'INR' => 'Indian Rupees');
										echo $names[$fields->currency] ?? $fields->currency;
									?></span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Default Billing Settings -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Default Billing Settings</h5>
				</div>
				<div class="card-body">
					<div class="alert alert-info">
						<strong>Note:</strong> These settings are used as defaults for new rate cards. Existing rate cards are not affected.
					</div>
					
					<div class="row">
						<div class="form-group col-md-6">
							<label>Billing Increment (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="billing_increment" name="billing_increment" required>
								<option value="1" <?php echo set_select('billing_increment', '1', ($fields->billing_increment == 1)); ?>>1 second</option>
								<option value="6" <?php echo set_select('billing_increment', '6', ($fields->billing_increment == 6)); ?>>6 seconds</option>
								<option value="30" <?php echo set_select('billing_increment', '30', ($fields->billing_increment == 30)); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('billing_increment', '60', ($fields->billing_increment == 60)); ?>>60 seconds (1 minute)</option>
							</select>
							<small class="form-text text-muted">Default billing increment for calls</small>
						</div>
						<div class="form-group col-md-6">
							<label>Minimum Duration (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="minimum_duration" name="minimum_duration" required>
								<option value="0" <?php echo set_select('minimum_duration', '0', ($fields->minimum_duration == 0)); ?>>No minimum</option>
								<option value="30" <?php echo set_select('minimum_duration', '30', ($fields->minimum_duration == 30)); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('minimum_duration', '60', ($fields->minimum_duration == 60)); ?>>60 seconds (1 minute)</option>
								<option value="120" <?php echo set_select('minimum_duration', '120', ($fields->minimum_duration == 120)); ?>>120 seconds (2 minutes)</option>
							</select>
							<small class="form-text text-muted">Default minimum billable duration</small>
						</div>
					</div>
					
					<!-- Billing Example -->
					<div class="row">
						<div class="col-md-12">
							<div class="card bg-light">
								<div class="card-body">
									<h6>Billing Example:</h6>
									<p id="billing_example" class="mb-0">
										With <?php echo $fields->billing_increment; ?>s increment and <?php echo $fields->minimum_duration; ?>s minimum.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			
			<!-- Provider Usage Information -->
			<div class="card mb-4">
				<div class="card-header bg-warning text-dark">
					<h5>Current Usage Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-3">
							<div class="card bg-primary text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->total_rate_cards ?: 0; ?></h4>
									<p>Rate Cards</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-success text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->active_rate_cards ?: 0; ?></h4>
									<p>Active Rate Cards</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-info text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->total_users ?: 0; ?></h4>
									<p>Users</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-secondary text-white">
								<div class="card-body text-center">
									<h4>0</h4>
									<p>Total Calls</p>
								</div>
							</div>
						</div>
					</div>
					
					<?php if($fields->total_rate_cards > 0): ?>
					<div class="alert alert-warning mt-3">
						<strong>Important:</strong> This provider has <?php echo $fields->total_rate_cards; ?> rate card(s). 
						Changes to currency or status may affect billing for users.
					</div>
					<?php endif; ?>
				</div>
			</div>
			
			<!-- Change Preview -->
			<div class="card mb-4" id="change_preview" style="display: none;">
				<div class="card-header bg-success text-white">
					<h5>Change Preview</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-6">
							<h6>Current Values:</h6>
							<table class="table table-sm">
								<tr>
									<td>Name:</td>
									<td><strong><?php echo $fields->name; ?></strong></td>
								</tr>
								<tr>
									<td>Currency:</td>
									<td><strong><?php echo $fields->currency; ?></strong></td>
								</tr>
								<tr>
									<td>Status:</td>
									<td><strong><?php echo ucfirst($fields->status); ?></strong></td>
								</tr>
								<tr>
									<td>Billing:</td>
									<td><strong><?php echo $fields->billing_increment; ?>s / <?php echo $fields->minimum_duration; ?>s</strong></td>
								</tr>
							</table>
						</div>
						<div class="col-md-6">
							<h6>New Values (Live Preview):</h6>
							<table class="table table-sm">
								<tr>
									<td>Name:</td>
									<td><strong id="new_name"><?php echo $fields->name; ?></strong></td>
								</tr>
								<tr>
									<td>Currency:</td>
									<td><strong id="new_currency"><?php echo $fields->currency; ?></strong></td>
								</tr>
								<tr>
									<td>Status:</td>
									<td><strong id="new_status"><?php echo ucfirst($fields->status); ?></strong></td>
								</tr>
								<tr>
									<td>Billing:</td>
									<td><strong id="new_billing"><?php echo $fields->billing_increment; ?>s / <?php echo $fields->minimum_duration; ?>s</strong></td>
								</tr>
							</table>
						</div>
					</div>
				</div>
			</div>
			
			<hr>
			<div class="row">
				<div class="col-md-12">
					<button type="submit" class="btn btn-success btn-sm">Update Provider</button>
					<a href="<?php echo base_url();?>providers/view/<?php echo $fields->id; ?>" class="btn btn-info btn-sm">View Details</a>
					<a href="<?php echo base_url();?>providers" class="btn btn-warning btn-sm">Cancel</a>
					<a href="<?php echo base_url();?>providers/delete/<?php echo $fields->id; ?>" class="btn btn-danger btn-sm">Delete Provider</a>
				</div>
			</div>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	$(document).ready(function(){
		// Update preview when values change
		$('#name, #currency, #status, #billing_increment, #minimum_duration').on('input change', updateChangePreview);
		
		// Update billing example when increment/minimum changes
		$('#billing_increment, #minimum_duration').on('change', updateBillingExample);
		
		// Set initial state
		updateCurrencyInfo($('#currency').val());
		updateBillingExample();
		
		// Status change warning
		$('#status').change(function(){
			showStatusWarning($(this).val());
		});
	});
	
	function updateCurrencyInfo(currency){
		if(!currency){
			return;
		}
		
		var symbols = {
			'USD': '$', 'EUR': '€', 'GBP': '£', 'PKR': '₨', 'AED': 'د.إ',
			'CAD': 'C$', 'AUD': 'A$', 'INR': '₹'
		};
		
		var names = {
			'USD': 'US Dollars', 'EUR': 'Euros', 'GBP': 'British Pounds', 
			'PKR': 'Pakistani Rupees', 'AED': 'UAE Dirhams', 'CAD': 'Canadian Dollars',
			'AUD': 'Australian Dollars', 'INR': 'Indian Rupees'
		};
		
		$('#currency_symbol').text(symbols[currency] || currency);
		$('#currency_name').text(names[currency] || currency);
	}
	
	function updateBillingExample(){
		var increment = parseInt($('#billing_increment').val()) || 60;
		var minimum = parseInt($('#minimum_duration').val()) || 60;
		
		var example = 'With ' + increment + 's increment and ' + minimum + 's minimum: ';
		if(minimum > 0){
			if(increment >= minimum){
				example += 'A ' + Math.floor(minimum/2) + '-second call will be billed for ' + minimum + ' seconds.';
			} else {
				var testDuration = Math.floor(minimum * 1.5);
				var billedDuration = Math.ceil(testDuration / increment) * increment;
				example += 'A ' + testDuration + '-second call will be billed for ' + billedDuration + ' seconds.';
			}
		} else {
			example += 'No minimum duration. Calls billed in ' + increment + '-second increments.';
		}
		
		$('#billing_example').text(example);
	}
	
	function updateChangePreview(){
		var name = $('#name').val();
		var currency = $('#currency').val();
		var status = $('#status').val();
		var increment = $('#billing_increment').val();
		var minimum = $('#minimum_duration').val();
		
		// Check if any values have changed
		var originalName = '<?php echo $fields->name; ?>';
		var originalCurrency = '<?php echo $fields->currency; ?>';
		var originalStatus = '<?php echo $fields->status; ?>';
		var originalIncrement = '<?php echo $fields->billing_increment; ?>';
		var originalMinimum = '<?php echo $fields->minimum_duration; ?>';
		
		var hasChanges = (name !== originalName || currency !== originalCurrency || 
						 status !== originalStatus || increment !== originalIncrement || 
						 minimum !== originalMinimum);
		
		if(hasChanges){
			$('#new_name').text(name);
			$('#new_currency').text(currency);
			$('#new_status').text(ucfirst(status));
			$('#new_billing').text(increment + 's / ' + minimum + 's');
			$('#change_preview').show();
		} else {
			$('#change_preview').hide();
		}
	}
	
	function showStatusWarning(status){
		var rateCards = <?php echo $fields->total_rate_cards ?: 0; ?>;
		
		if(rateCards > 0 && status === 'inactive'){
			if(!confirm('This provider has ' + rateCards + ' rate card(s). Setting status to "inactive" may affect users assigned to these rate cards. Are you sure you want to continue?')){
				$('#status').val('<?php echo $fields->status; ?>');
			}
		}
	}
	
	function ucfirst(str){
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
  </script>

</body>

</html>