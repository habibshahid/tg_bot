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
        <h3 class="mt-4">Add Provider</h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>providers">Providers</a></li>
				<li class="breadcrumb-item active">Add Provider</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("providers/add",$attributes);?>
		
			<!-- Basic Information -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Basic Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Provider Name <span class="text-danger">*</span></label>
							<input class="form-control" id="name" name="name" placeholder="Enter Provider Name" value="<?php echo set_value('name'); ?>" required />
							<small class="form-text text-muted">Choose a unique name for this provider</small>
						</div>
						<div class="form-group col-md-6">
							<label>Status</label>
							<select class="form-control" id="status" name="status" required>
								<option value="active" <?php echo set_select('status', 'active', TRUE); ?>>Active</option>
								<option value="inactive" <?php echo set_select('status', 'inactive'); ?>>Inactive</option>
							</select>
						</div>
					</div>
					
					<div class="row">
						<div class="form-group col-md-12">
							<label>Description</label>
							<textarea class="form-control" id="description" name="description" rows="3" placeholder="Enter description for this provider..."><?php echo set_value('description'); ?></textarea>
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
								<option value="USD" <?php echo set_select('currency', 'USD', TRUE); ?>>USD - US Dollar</option>
								<option value="EUR" <?php echo set_select('currency', 'EUR'); ?>>EUR - Euro</option>
								<option value="GBP" <?php echo set_select('currency', 'GBP'); ?>>GBP - British Pound</option>
								<option value="PKR" <?php echo set_select('currency', 'PKR'); ?>>PKR - Pakistani Rupee</option>
								<option value="AED" <?php echo set_select('currency', 'AED'); ?>>AED - UAE Dirham</option>
								<option value="CAD" <?php echo set_select('currency', 'CAD'); ?>>CAD - Canadian Dollar</option>
								<option value="AUD" <?php echo set_select('currency', 'AUD'); ?>>AUD - Australian Dollar</option>
								<option value="INR" <?php echo set_select('currency', 'INR'); ?>>INR - Indian Rupee</option>
							</select>
							<small class="form-text text-muted">Default currency for rate cards from this provider</small>
						</div>
						<div class="form-group col-md-6">
							<div id="currency_info" style="display: none;">
								<div class="alert alert-info">
									<strong>Currency Symbol:</strong> <span id="currency_symbol"></span><br>
									<strong>Currency Name:</strong> <span id="currency_name"></span>
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
						<strong>Note:</strong> These settings will be used as defaults for new rate cards created with this provider.
					</div>
					
					<div class="row">
						<div class="form-group col-md-6">
							<label>Billing Increment (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="billing_increment" name="billing_increment" required>
								<option value="1" <?php echo set_select('billing_increment', '1'); ?>>1 second</option>
								<option value="6" <?php echo set_select('billing_increment', '6'); ?>>6 seconds</option>
								<option value="30" <?php echo set_select('billing_increment', '30'); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('billing_increment', '60', TRUE); ?>>60 seconds (1 minute)</option>
							</select>
							<small class="form-text text-muted">Default billing increment for calls</small>
						</div>
						<div class="form-group col-md-6">
							<label>Minimum Duration (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="minimum_duration" name="minimum_duration" required>
								<option value="0" <?php echo set_select('minimum_duration', '0'); ?>>No minimum</option>
								<option value="30" <?php echo set_select('minimum_duration', '30'); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('minimum_duration', '60', TRUE); ?>>60 seconds (1 minute)</option>
								<option value="120" <?php echo set_select('minimum_duration', '120'); ?>>120 seconds (2 minutes)</option>
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
										With 60s increment and 60s minimum: A 45-second call will be billed for 60 seconds.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Contact Information -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Contact Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-12">
							<label>Contact Information</label>
							<textarea class="form-control" id="contact_info" name="contact_info" rows="4" placeholder="Enter contact details for this provider (email, phone, address, etc.)..."><?php echo set_value('contact_info'); ?></textarea>
							<small class="form-text text-muted">Optional: Contact details for support or business purposes</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Provider Preview -->
			<div class="card mb-4" id="provider_preview" style="display: none;">
				<div class="card-header bg-info text-white">
					<h5>Provider Preview</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-6">
							<table class="table table-borderless">
								<tr>
									<td><strong>Name:</strong></td>
									<td id="preview_name">-</td>
								</tr>
								<tr>
									<td><strong>Currency:</strong></td>
									<td id="preview_currency">-</td>
								</tr>
								<tr>
									<td><strong>Status:</strong></td>
									<td id="preview_status">-</td>
								</tr>
							</table>
						</div>
						<div class="col-md-6">
							<table class="table table-borderless">
								<tr>
									<td><strong>Billing Increment:</strong></td>
									<td id="preview_increment">-</td>
								</tr>
								<tr>
									<td><strong>Minimum Duration:</strong></td>
									<td id="preview_minimum">-</td>
								</tr>
							</table>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<strong>Description:</strong>
							<p id="preview_description" class="text-muted">-</p>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Next Steps -->
			<div class="card mb-4">
				<div class="card-header bg-success text-white">
					<h5>After Creating Provider</h5>
				</div>
				<div class="card-body">
					<p>Once you create this provider, you can:</p>
					<ul>
						<li><strong>Create Rate Cards:</strong> Set up pricing structures for this provider</li>
						<li><strong>Configure Rates:</strong> Add destination rates and pricing</li>
						<li><strong>Assign to Users:</strong> Link users to rate cards from this provider</li>
						<li><strong>Monitor Performance:</strong> Track call volumes and revenue</li>
					</ul>
					<div class="alert alert-info">
						<strong>Tip:</strong> Start with "Active" status and create rate cards immediately after provider creation.
					</div>
				</div>
			</div>
			
			<hr>
			<button type="submit" class="btn btn-success btn-sm">Create Provider</button>
			<a href="<?php echo base_url();?>providers" class="btn btn-warning btn-sm">Cancel</a>
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
		$('#name, #description, #currency, #status, #billing_increment, #minimum_duration').on('input change', updatePreview);
		
		// Update billing example when increment/minimum changes
		$('#billing_increment, #minimum_duration').on('change', updateBillingExample);
		
		// Initial updates
		updateCurrencyInfo($('#currency').val());
		updateBillingExample();
	});
	
	function updateCurrencyInfo(currency){
		if(!currency){
			$('#currency_info').hide();
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
		$('#currency_info').show();
	}
	
	function updateBillingExample(){
		var increment = parseInt($('#billing_increment').val()) || 60;
		var minimum = parseInt($('#minimum_duration').val()) || 60;
		
		var example = '';
		if(minimum > 0){
			example = 'With ' + increment + 's increment and ' + minimum + 's minimum: ';
			if(increment >= minimum){
				example += 'A ' + Math.floor(minimum/2) + '-second call will be billed for ' + minimum + ' seconds.';
			} else {
				var testDuration = Math.floor(minimum * 1.5);
				var billedDuration = Math.ceil(testDuration / increment) * increment;
				example += 'A ' + testDuration + '-second call will be billed for ' + billedDuration + ' seconds.';
			}
		} else {
			example = 'With ' + increment + 's increment and no minimum: A ' + Math.floor(increment * 1.5) + '-second call will be billed for ' + (Math.ceil(Math.floor(increment * 1.5) / increment) * increment) + ' seconds.';
		}
		
		$('#billing_example').text(example);
	}
	
	function updatePreview(){
		var name = $('#name').val();
		var currency = $('#currency').val();
		var status = $('#status').val();
		var increment = $('#billing_increment').val();
		var minimum = $('#minimum_duration').val();
		var description = $('#description').val();
		
		if(!name || !currency){
			$('#provider_preview').hide();
			return;
		}
		
		$('#preview_name').text(name);
		$('#preview_currency').text(currency);
		$('#preview_status').html('<span class="badge badge-' + getStatusClass(status) + '">' + ucfirst(status) + '</span>');
		$('#preview_increment').text(increment + ' seconds');
		$('#preview_minimum').text(minimum + ' seconds');
		$('#preview_description').text(description || 'No description provided');
		
		$('#provider_preview').show();
	}
	
	function getStatusClass(status){
		return status === 'active' ? 'success' : 'secondary';
	}
	
	function ucfirst(str){
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
  </script>

</body>

</html>